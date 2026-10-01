import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config, publicConfig } from './config.js';
import { runAnalysis, AnalysisError } from './analysis/service.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(root, 'dist');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.svg', '.webmanifest', '.txt']);
const ALLOWED_IMAGES = new Set(['image/jpeg', 'image/png', 'image/webp']);

// The only error text the browser ever receives. Provider names, upstream messages and
// configuration details stay in the server log.
const PUBLIC_MESSAGES = {
  not_connected: 'AI analysis is temporarily unavailable.',
  provider_auth: 'AI analysis is temporarily unavailable.',
  provider_busy: 'The analysis service is busy.',
  provider_unavailable: 'The analysis service is unavailable.',
  provider_error: 'The analysis failed.',
  timeout: 'The analysis took too long.',
  invalid_output: 'The analysis returned an incomplete answer.',
  unrecognized: 'The piece could not be identified.',
  invalid_image: 'The photo could not be read.',
  image_too_large: 'The photo is too large.',
  rate_limited: 'Too many appraisals. Try again later.',
  internal: 'Unexpected server error.',
};
const publicError = (code) => ({ code, message: PUBLIC_MESSAGES[code] ?? PUBLIC_MESSAGES.internal });

const SECURITY_HEADERS = {
  'content-security-policy':
    "default-src 'self'; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'",
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(self), microphone=(), geolocation=()',
};

// --- helpers ---------------------------------------------------------------

function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store', ...SECURITY_HEADERS });
  res.end(JSON.stringify(body));
}

// Reads the body up to `limit`. Past the limit the rest is drained (so the client receives a clean 413),
// and anything absurdly large is cut off.
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let tooLarge = false;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) tooLarge = true;
      if (size > limit * 4) req.destroy();
      if (!tooLarge) chunks.push(chunk);
    });
    req.on('end', () =>
      tooLarge ? reject(new AnalysisError('image_too_large', 'The photo is too large.')) : resolve(Buffer.concat(chunks).toString('utf8')),
    );
    req.on('error', reject);
  });
}

// Simple per-IP limiter to protect the AI budget. Resets on restart, which is acceptable here.
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 3_600_000);
  if (recent.length >= config.rateLimitPerHour) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

function clientIp(req) {
  return (req.headers['x-forwarded-for']?.split(',')[0] ?? req.socket.remoteAddress ?? 'unknown').trim();
}

function parseImage(body) {
  let json;
  try {
    json = JSON.parse(body);
  } catch {
    throw new AnalysisError('invalid_image', 'The request did not contain a photo.');
  }
  const match = /^data:(image\/[a-z+]+);base64,([A-Za-z0-9+/=]+)$/.exec(json?.image ?? '');
  if (!match || !ALLOWED_IMAGES.has(match[1])) throw new AnalysisError('invalid_image', 'The photo format is not supported.');
  const bytes = Math.floor((match[2].length * 3) / 4);
  if (bytes > config.maxImageBytes) throw new AnalysisError('image_too_large', 'The photo is too large.');
  if (bytes < 2_000) throw new AnalysisError('invalid_image', 'The photo is empty or damaged.');
  return { mediaType: match[1], base64: match[2] };
}

// --- analysis (Server-Sent Events over a POST response) --------------------

async function handleAnalyze(req, res) {
  if (rateLimited(clientIp(req))) {
    return sendJson(res, 429, { error: publicError('rate_limited') });
  }

  let image;
  try {
    image = parseImage(await readBody(req, Math.ceil(config.maxImageBytes * 1.4) + 1024));
  } catch (error) {
    const code = error instanceof AnalysisError ? error.code : 'invalid_image';
    return sendJson(res, code === 'image_too_large' ? 413 : 400, { error: publicError(code) });
  }

  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-store',
    connection: 'keep-alive',
    'x-accel-buffering': 'no',
    ...SECURITY_HEADERS,
  });

  const controller = new AbortController();
  res.on('close', () => controller.abort());
  const emit = (event, data) => {
    if (!res.writableEnded) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  const heartbeat = setInterval(() => res.write(': keep-alive\n\n'), 15_000);

  try {
    const appraisal = await runAnalysis({ image, emit, signal: controller.signal });
    emit('result', appraisal);
  } catch (error) {
    if (!controller.signal.aborted) {
      const code = error instanceof AnalysisError ? error.code : 'internal';
      if (code === 'not_connected') console.error('[analyze] ANTHROPIC_API_KEY (or another AI key) is not set on the server');
      else if (code !== 'unrecognized') console.error(`[analyze] ${code}: ${error.message}`);
      emit('error', publicError(code));
    }
  } finally {
    clearInterval(heartbeat);
    res.end();
  }
}

// --- static files ----------------------------------------------------------

const cache = new Map();

async function loadStatic(filePath) {
  if (cache.has(filePath)) return cache.get(filePath);
  const info = await stat(filePath);
  if (!info.isFile()) return null;
  const ext = path.extname(filePath);
  const body = await readFile(filePath);
  const entry = { ext, body, gzip: COMPRESSIBLE.has(ext) && body.length > 1024 ? gzipSync(body) : null };
  if (process.env.NODE_ENV !== 'development') cache.set(filePath, entry);
  return entry;
}

async function serveStatic(req, res, pathname) {
  const safe = path.normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  let filePath = path.join(distDir, safe);
  if (!filePath.startsWith(distDir)) return sendJson(res, 400, { error: { code: 'bad_path' } });

  let entry = null;
  try {
    entry = await loadStatic(filePath);
  } catch {
    /* not found: fall through to the app shell */
  }
  const isAsset = Boolean(path.extname(safe));
  if (!entry) {
    if (isAsset) {
      res.writeHead(404, SECURITY_HEADERS);
      return res.end();
    }
    filePath = path.join(distDir, 'index.html');
    try {
      entry = await loadStatic(filePath);
    } catch {
      res.writeHead(503, { 'content-type': 'text/plain', ...SECURITY_HEADERS });
      return res.end('VINTAGEM is not built yet. Run "npm run build".');
    }
  }

  const hashed = /\.[0-9a-f]{8,}\./.test(filePath) || filePath.includes(`${path.sep}fonts${path.sep}`);
  const headers = {
    'content-type': MIME[entry.ext] ?? 'application/octet-stream',
    'cache-control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache',
    ...SECURITY_HEADERS,
  };
  const acceptsGzip = /\bgzip\b/.test(req.headers['accept-encoding'] ?? '');
  if (entry.gzip && acceptsGzip) {
    res.writeHead(200, { ...headers, 'content-encoding': 'gzip', vary: 'accept-encoding' });
    return res.end(entry.gzip);
  }
  res.writeHead(200, headers);
  res.end(entry.body);
}

// --- router ----------------------------------------------------------------

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  try {
    if (pathname === '/api/health') return sendJson(res, 200, { ok: true });
    if (pathname === '/api/config' && req.method === 'GET') return sendJson(res, 200, publicConfig());
    if (pathname === '/api/analyze') {
      if (req.method !== 'POST') return sendJson(res, 405, { error: { code: 'method_not_allowed' } });
      return await handleAnalyze(req, res);
    }
    if (pathname.startsWith('/api/')) return sendJson(res, 404, { error: { code: 'not_found' } });
    if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { error: { code: 'method_not_allowed' } });
    return await serveStatic(req, res, pathname);
  } catch (error) {
    console.error('[server]', error);
    if (!res.headersSent) sendJson(res, 500, { error: { code: 'internal', message: 'Unexpected server error.' } });
    else res.end();
  }
});

server.listen(config.port, () => {
  const ai = config.ai ? `${config.ai.provider} (${config.ai.model})` : 'NOT CONFIGURED: set ANTHROPIC_API_KEY';
  const market = config.market ? `${config.market.source} ${config.market.marketplace}` : 'not connected';
  console.log(`VINTAGEM on http://localhost:${config.port}  ·  analysis: ${ai}  ·  market: ${market}`);
});

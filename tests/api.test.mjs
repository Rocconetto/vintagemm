// API tests: run the real server against the test upstream and check the streamed protocol.
// Run with: npm test

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { startUpstream, calls, FIXTURE } from './upstream.mjs';

const PORT = 8799;
let upstream;
let app;
let appOffline;

function startApp(port, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['server/index.js'], {
      env: { PATH: process.env.PATH, PORT: String(port), ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', (d) => d.toString().includes('VINTAGEM on') && resolve(child));
    child.on('exit', (code) => reject(new Error(`server exited ${code}`)));
  });
}

const base = `http://127.0.0.1:${PORT}`;
const scenario = (name) => fetch(`http://127.0.0.1:${upstream.address().port}/__scenario`, { method: 'POST', body: name });
// A tiny but valid JPEG payload is enough: the server only checks format and size.
const IMAGE = `data:image/jpeg;base64,${Buffer.alloc(4096, 7).toString('base64')}`;

async function analyze(port = PORT, image = IMAGE) {
  const res = await fetch(`http://127.0.0.1:${port}/api/analyze`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ image }),
  });
  const text = await res.text();
  const events = text
    .split('\n\n')
    .filter((b) => b.startsWith('event:'))
    .map((b) => ({ event: /event: (.+)/.exec(b)[1], data: JSON.parse(/data: (.+)/.exec(b)[1]) }));
  return { status: res.status, events, text };
}

before(async () => {
  upstream = await startUpstream();
  const up = `http://127.0.0.1:${upstream.address().port}`;
  app = await startApp(PORT, {
    ANTHROPIC_API_KEY: 'test-key',
    AI_BASE_URL: up,
    EBAY_CLIENT_ID: 'id',
    EBAY_CLIENT_SECRET: 'secret',
    EBAY_API_BASE: up,
    RATE_LIMIT_PER_HOUR: '100',
  });
  appOffline = await startApp(PORT + 1, {});
});

after(() => {
  app?.kill();
  appOffline?.kill();
  upstream?.close();
});

test('config says only what is available: no key, provider or model', async () => {
  const cfg = await (await fetch(`${base}/api/config`)).json();
  assert.deepEqual(cfg, { analysis: { available: true }, market: { available: true } });
});

test('full appraisal: phases follow the stream, result is normalized, market is real', async () => {
  await scenario('full');
  const { events } = await analyze();
  const phases = events.filter((e) => e.event === 'phase').map((e) => `${e.data.id}:${e.data.status}`);
  const order = ['scan', 'labels', 'brand', 'era', 'material', 'rarity', 'value'];
  for (const id of order) assert.ok(phases.includes(`${id}:done`), `${id} done`);
  // each phase becomes done only after the previous one
  const doneIndex = order.map((id) => phases.indexOf(`${id}:done`));
  assert.deepEqual([...doneIndex].sort((a, b) => a - b), doneIndex);
  assert.ok(phases.includes('market:active') && phases.includes('market:done'));

  const result = events.find((e) => e.event === 'result').data;
  assert.equal(result.brand, FIXTURE.brand);
  assert.deepEqual(result.estimate, { currency: 'EUR', low: 85, high: 140 });
  assert.equal(result.confidence, 78);
  assert.equal(result.materialSource, 'label');
  assert.equal(result.market.status, 'ok');
  assert.equal(result.market.items.length, 3);
  assert.equal(result.market.summary.median, 95);
  assert.equal(calls.lastQuery, FIXTURE.marketQuery);
  assert.match(result.id, /^[0-9a-f-]{36}$/);
  assert.equal(result.engine, undefined, 'provider and model are not sent to the browser');
});

test('the backend calls Anthropic with the server key, and streams progress before the result', async () => {
  await scenario('slow');
  const before = calls.anthropic;
  const res = await fetch(`${base}/api/analyze`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ image: IMAGE }),
  });
  assert.equal(res.headers.get('content-type'), 'text/event-stream; charset=utf-8');
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let text = '';
  let firstPhaseAt = null;
  let resultAt = null;
  const t0 = Date.now();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    text += value;
    if (firstPhaseAt === null && text.includes('event: phase')) firstPhaseAt = Date.now() - t0;
    if (resultAt === null && text.includes('event: result')) resultAt = Date.now() - t0;
  }
  assert.equal(calls.anthropic, before + 1, 'exactly one Anthropic call');
  assert.equal(calls.lastApiKey, 'test-key', 'server key sent upstream by the backend');
  assert.ok(firstPhaseAt !== null && resultAt !== null && resultAt - firstPhaseAt > 200, `streamed: phase at ${firstPhaseAt}ms, result at ${resultAt}ms`);
});

test('no key, provider name or upstream detail ever reaches the browser', async () => {
  const bodies = [];
  for (const name of ['full', 'http500', 'garbage', 'unrecognized']) {
    await scenario(name);
    bodies.push((await analyze()).text);
  }
  bodies.push(await (await fetch(`${base}/api/config`)).text());
  bodies.push(await (await fetch(`${base}/`)).text());
  const all = bodies.join('\n');
  for (const secret of ['test-key', 'anthropic', 'Claude', 'claude-sonnet', 'overloaded', 'ebay-token', 'secret']) {
    assert.ok(!all.toLowerCase().includes(secret.toLowerCase()), `"${secret}" leaked to the browser`);
  }
});

test('sparse answers stay empty instead of being filled in', async () => {
  await scenario('sparse');
  const { events } = await analyze();
  const result = events.find((e) => e.event === 'result').data;
  assert.equal(result.brand, null, '"unknown" becomes null');
  assert.equal(result.estimate, null);
  assert.equal(result.confidence, null);
  assert.equal(result.market.status, 'no_query');
  assert.deepEqual(result.market.items, []);
  const market = events.find((e) => e.event === 'phase' && e.data.id === 'market');
  assert.equal(market.data.status, 'skipped');
});

test('unrecognized piece returns a clear error code', async () => {
  await scenario('unrecognized');
  const { events } = await analyze();
  const error = events.find((e) => e.event === 'error');
  assert.equal(error.data.code, 'unrecognized');
  assert.ok(!events.some((e) => e.event === 'result'));
});

test('unreadable model output is reported, not guessed', async () => {
  await scenario('garbage');
  const { events } = await analyze();
  assert.equal(events.find((e) => e.event === 'error').data.code, 'invalid_output');
});

test('provider outage maps to provider_unavailable', async () => {
  await scenario('http500');
  const { events } = await analyze();
  assert.equal(events.find((e) => e.event === 'error').data.code, 'provider_unavailable');
});

test('empty market search shows as empty, not invented', async () => {
  await scenario('nomarket');
  const { events } = await analyze();
  const result = events.find((e) => e.event === 'result').data;
  assert.equal(result.market.status, 'empty');
  assert.equal(result.market.summary, null);
});

test('without an AI key the server says so and analyzes nothing', async () => {
  const before = calls.anthropic;
  const { events } = await analyze(PORT + 1);
  assert.equal(events.find((e) => e.event === 'error').data.code, 'not_connected');
  assert.equal(calls.anthropic, before);
  const error = events.find((e) => e.event === 'error').data;
  assert.equal(error.message, 'AI analysis is temporarily unavailable.');
  const cfg = await (await fetch(`http://127.0.0.1:${PORT + 1}/api/config`)).json();
  assert.deepEqual(cfg, { analysis: { available: false }, market: { available: false } });
});

test('rejects non-images and oversized payloads', async () => {
  const bad = await analyze(PORT, 'data:text/plain;base64,aGVsbG8=');
  assert.equal(bad.status, 400);
  const big = await analyze(PORT, `data:image/jpeg;base64,${Buffer.alloc(7 * 1024 * 1024).toString('base64')}`);
  assert.equal(big.status, 413);
});

test('serves the app shell for client routes and 404s missing assets', async () => {
  const page = await fetch(`${base}/appraisal/abc`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /<div id="root">/);
  assert.equal((await fetch(`${base}/missing.js`)).status, 404);
  assert.equal((await fetch(`${base}/api/nope`)).status, 404);
});

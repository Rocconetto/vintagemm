// Test-only stand-in for the AI provider (Anthropic Messages streaming format) and the eBay API.
// It lets the automated tests exercise the real provider adapter, phase tracking and market code
// without network access. It is never imported by the application.

import http from 'node:http';

export const FIXTURE = {
  recognized: true,
  unrecognizedReason: null,
  title: 'Denim trucker jacket',
  labels: ['LEVI STRAUSS & CO.', 'MADE IN U.S.A.', '100% COTTON', 'SIZE 42'],
  brand: "Levi's",
  brandEvidence: 'Red tab and woven neck label',
  itemType: 'Trucker jacket',
  category: 'Denim',
  era: '1990s',
  eraEvidence: 'Neck label layout and care tag format',
  size: '42',
  fit: 'Boxy',
  material: '100% cotton',
  materialSource: 'label',
  origin: 'Made in U.S.A.',
  rarity: 'uncommon',
  availability: 'available',
  estimate: { low: 85, high: 140 },
  confidence: 78,
  assessment: {
    condition: 'Even fade with light wear at the cuffs and collar.',
    positives: ['US-made production', 'Original metal buttons'],
    concerns: ['Check the inner pocket lining for repairs'],
    authenticity: 'Label typography and button stamping are consistent with the period.',
  },
  technicalNote: 'Type III construction with pleated front panels.\n\nDating rests on the care label format.',
  marketQuery: 'levis trucker jacket 90s usa',
};

let scenario = 'full';
export const calls = { anthropic: 0, ebaySearch: 0, lastQuery: null, lastApiKey: null };

function streamAnthropic(res, text, { chunk = 24, delay = 2 } = {}) {
  res.writeHead(200, { 'content-type': 'text/event-stream' });
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  send('message_start', { type: 'message_start', message: { id: 'msg_test' } });
  send('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } });
  let i = 0;
  const tick = () => {
    if (i >= text.length) {
      send('content_block_stop', { type: 'content_block_stop', index: 0 });
      send('message_stop', { type: 'message_stop' });
      return res.end();
    }
    send('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: text.slice(i, i + chunk) } });
    i += chunk;
    setTimeout(tick, delay);
  };
  tick();
}

export function startUpstream(port = 0) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    let body = '';
    for await (const c of req) body += c;

    if (url.pathname === '/__scenario') {
      scenario = body;
      return res.end('ok');
    }

    if (url.pathname === '/v1/messages') {
      calls.anthropic++;
      calls.lastApiKey = req.headers['x-api-key'];
      if (req.headers['x-api-key'] !== 'test-key') {
        res.writeHead(401);
        return res.end('{"error":{"message":"invalid x-api-key"}}');
      }
      const parsed = JSON.parse(body);
      const hasImage = parsed.messages?.[0]?.content?.some((c) => c.type === 'image' && c.source?.data);
      if (!hasImage) {
        res.writeHead(400);
        return res.end('no image');
      }
      if (scenario === 'http500') {
        res.writeHead(529);
        return res.end('overloaded');
      }
      if (scenario === 'unrecognized') {
        return streamAnthropic(res, JSON.stringify({ recognized: false, unrecognizedReason: 'The photo shows a landscape.' }));
      }
      if (scenario === 'garbage') return streamAnthropic(res, 'I am not able to help with that.');
      if (scenario === 'sparse') {
        return streamAnthropic(res, JSON.stringify({ recognized: true, title: 'Knit sweater', labels: [], brand: 'unknown', era: null, estimate: null, confidence: null, assessment: {}, marketQuery: null }));
      }
      if (scenario === 'slow') return streamAnthropic(res, '```json\n' + JSON.stringify(FIXTURE, null, 2) + '\n```', { chunk: 6, delay: 18 });
      return streamAnthropic(res, '```json\n' + JSON.stringify(FIXTURE, null, 2) + '\n```');
    }

    if (url.pathname === '/identity/v1/oauth2/token') {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ access_token: 'ebay-token', expires_in: 7200 }));
    }

    if (url.pathname === '/buy/browse/v1/item_summary/search') {
      calls.ebaySearch++;
      calls.lastQuery = url.searchParams.get('q');
      res.writeHead(200, { 'content-type': 'application/json' });
      if (scenario === 'nomarket') return res.end(JSON.stringify({ total: 0 }));
      return res.end(
        JSON.stringify({
          itemSummaries: [
            { title: 'Levis Type III trucker 90s USA', price: { value: '95.00', currency: 'EUR' }, itemWebUrl: 'https://www.ebay.it/itm/1', itemCreationDate: '2026-09-20T10:00:00.000Z' },
            { title: 'Vintage Levis denim jacket made in USA', price: { value: '120.00', currency: 'EUR' }, itemWebUrl: 'https://www.ebay.it/itm/2' },
            { title: 'Levis trucker 1990s size L', price: { value: '80.00', currency: 'EUR' }, itemWebUrl: 'https://www.ebay.it/itm/3', itemCreationDate: '2026-09-28T10:00:00.000Z' },
          ],
        }),
      );
    }

    res.writeHead(404);
    res.end();
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

if (process.argv[1]?.endsWith('upstream.mjs')) {
  const server = await startUpstream(Number(process.env.UPSTREAM_PORT) || 9911);
  console.log(`test upstream on ${server.address().port}`);
}

// AdFlow mock event server (synthetic data only). Streams AdImpression / AdClick events shaped like
// shared/contracts/ad-events.asyncapi.yaml over WebSocket (/ws) and Server-Sent Events (/sse).
// The emission rate is global and adjustable at runtime: POST /rate {"eps": 5000}.
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { extname, join, normalize } from 'node:path';
import { WebSocketServer, WebSocket } from 'ws';

const PORT = Number(process.env.PORT ?? 4310);
const TICK_MS = 20;
const MAX_EPS = 50_000;
const DUPLICATE_RATE = 0.005; // at-least-once delivery: occasionally re-send a recent event
const STATIC_DIR = process.env.STATIC_DIR ? normalize(join(process.cwd(), process.env.STATIC_DIR)) : null;

const CAMPAIGNS = [
  ['cmp-aurora', 0.06], ['cmp-borealis', 0.035], ['cmp-cobalt', 0.02], ['cmp-dune', 0.045],
  ['cmp-ember', 0.012], ['cmp-fjord', 0.03], ['cmp-glacier', 0.008], ['cmp-harbor', 0.05],
];
const RATE_PRESETS = [10, 100, 1000, 5000, 20000];

let rate = Number(process.env.EPS ?? 50);
let carry = 0;
const recent = [];
const sseClients = new Set();

function makeEvents(count) {
  const out = [];
  const now = new Date().toISOString();
  for (let i = 0; i < count; i++) {
    if (recent.length && Math.random() < DUPLICATE_RATE) {
      out.push(recent[Math.floor(Math.random() * recent.length)]);
      continue;
    }
    const [campaignId, ctr] = CAMPAIGNS[Math.floor(Math.random() * CAMPAIGNS.length)];
    const click = Math.random() < ctr;
    const e = {
      eventId: randomUUID(),
      type: click ? 'CLICK' : 'IMPRESSION',
      campaignId,
      costCents: click ? 20 + Math.floor(Math.random() * 60) : Math.floor(Math.random() * 4),
      occurredAt: now,
    };
    out.push(e);
    recent.push(e);
    if (recent.length > 200) recent.shift();
  }
  return out;
}

const json = (res, code, body) => {
  res.writeHead(code, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
  res.end(JSON.stringify(body));
};

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };
function serveStatic(req, res, pathname) {
  let file = normalize(join(STATIC_DIR, pathname));
  if (!file.startsWith(STATIC_DIR)) return json(res, 403, { error: 'forbidden' });
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(STATIC_DIR, 'index.html');
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
}

const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-headers', 'content-type');
  res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.writeHead(204).end();

  if (url.pathname === '/health') return json(res, 200, { status: 'ok' });
  if (url.pathname === '/config') {
    return json(res, 200, { campaigns: CAMPAIGNS.map(([id]) => id), rateEps: rate, ratePresets: RATE_PRESETS });
  }
  if (url.pathname === '/rate' && req.method === 'GET') return json(res, 200, { eps: rate });
  if (url.pathname === '/rate' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const eps = Number(JSON.parse(body || '{}').eps);
      if (!Number.isFinite(eps) || eps < 0 || eps > MAX_EPS) return json(res, 400, { error: `eps must be 0..${MAX_EPS}` });
      rate = Math.floor(eps);
      json(res, 200, { eps: rate });
    });
    return;
  }
  // Test/demo hook: drop every connection to exercise client reconnect.
  if (url.pathname === '/admin/drop' && req.method === 'POST') {
    let n = 0;
    for (const c of wss.clients) { c.terminate(); n++; }
    for (const r of sseClients) { r.destroy(); n++; }
    sseClients.clear();
    return json(res, 200, { dropped: n });
  }
  if (url.pathname === '/sse') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
    res.write(': connected\n\n');
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }
  if (STATIC_DIR) return serveStatic(req, res, url.pathname);
  json(res, 404, { error: 'not found' });
});

const wss = new WebSocketServer({ noServer: true });
server.on('upgrade', (req, socket, head) => {
  if (new URL(req.url, 'http://localhost').pathname !== '/ws') return socket.destroy();
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws));
});

setInterval(() => {
  carry += (rate * TICK_MS) / 1000;
  const count = Math.floor(carry);
  carry -= count;
  if (count === 0 || (wss.clients.size === 0 && sseClients.size === 0)) return;
  const events = makeEvents(count);
  const payloads = events.map((e) => JSON.stringify(e));
  for (const ws of wss.clients) {
    if (ws.readyState !== WebSocket.OPEN) continue;
    // Server-side backpressure: skip a slow consumer instead of buffering without bound.
    if (ws.bufferedAmount > 8 * 1024 * 1024) continue;
    for (const p of payloads) ws.send(p);
  }
  if (sseClients.size) {
    const chunk = payloads.map((p) => `data: ${p}\n\n`).join('');
    for (const r of sseClients) r.write(chunk);
  }
}, TICK_MS);

server.listen(PORT, () => console.log(`AdFlow mock event server on http://localhost:${PORT} (ws /ws, sse /sse, rate ${rate} ev/s)`));

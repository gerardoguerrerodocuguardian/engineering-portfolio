// Tiny dependency-free mock of the AdFlow Campaign API (subset of
// shared/contracts/campaign-api.openapi.yaml). Synthetic data only.
// Extra endpoint for tests: POST /__reset restores the seed data.
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.PORT ?? 3001);
const STATUSES = ['DRAFT', 'ACTIVE', 'PAUSED', 'EXHAUSTED'];
const WORDS = ['Spring', 'Summer', 'Autumn', 'Winter', 'Launch', 'Retarget', 'Brand', 'Promo', 'Flash', 'Loyalty'];

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type',
  'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
};

export function seed(n = 25) {
  const now = Date.now();
  return Array.from({ length: n }, (_, i) => ({
    id: `cmp_${String(i + 1).padStart(3, '0')}`,
    name: `${WORDS[i % WORDS.length]} campaign ${i + 1}`,
    status: STATUSES[i % STATUSES.length],
    dailyBudgetCents: 5000 + i * 1000,
    maxBidCents: 50 + i * 5,
    keywords: ['demo', `kw${i + 1}`],
    createdAt: new Date(now - (n - i) * 3_600_000).toISOString(),
  }));
}

let campaigns = seed();

const problem = (res, status, title, detail) => {
  res.writeHead(status, { 'content-type': 'application/problem+json', ...cors });
  res.end(JSON.stringify({ type: 'about:blank', title, status, detail }));
};
const json = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json', ...cors });
  res.end(JSON.stringify(body));
};
const readBody = (req) =>
  new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error('Malformed JSON'));
      }
    });
  });

const isInt = (v, min) => Number.isInteger(v) && v >= min;
function validate(b, partial) {
  const errs = [];
  if (!partial || 'name' in b) {
    if (typeof b.name !== 'string' || b.name.length < 3 || b.name.length > 120) errs.push('name must be 3-120 characters');
  }
  if (!partial || 'dailyBudgetCents' in b) {
    if (!isInt(b.dailyBudgetCents, 0)) errs.push('dailyBudgetCents must be an integer >= 0');
  }
  if (!partial || 'maxBidCents' in b) {
    if (!isInt(b.maxBidCents, 1)) errs.push('maxBidCents must be an integer >= 1');
  }
  if ('status' in b && !STATUSES.includes(b.status)) errs.push('status is invalid');
  if ('keywords' in b && !(Array.isArray(b.keywords) && b.keywords.every((k) => typeof k === 'string'))) {
    errs.push('keywords must be an array of strings');
  }
  return errs;
}

function report(c) {
  const n = Number(c.id.replace(/\D/g, '')) || 1;
  const impressions = 10_000 * n + 1234;
  const clicks = Math.round(impressions * (0.01 + (n % 5) * 0.004));
  return {
    campaignId: c.id,
    impressions,
    clicks,
    spendCents: clicks * Math.round(c.maxBidCents * 0.6),
    ctr: clicks / impressions,
  };
}

export const server = createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, cors);
      return res.end();
    }
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    if (url.pathname === '/__health') return json(res, 200, { ok: true });
    if (url.pathname === '/__reset' && req.method === 'POST') {
      campaigns = seed();
      return json(res, 200, { ok: true });
    }
    const parts = url.pathname.split('/').filter(Boolean); // v1 campaigns [id] [report]
    if (parts[0] !== 'v1' || parts[1] !== 'campaigns') return problem(res, 404, 'Not Found');
    if (!/^Bearer .+/.test(req.headers.authorization ?? '')) {
      return problem(res, 401, 'Unauthorized', 'Missing bearer token');
    }

    const [, , id, sub] = parts;
    if (!id) {
      if (req.method === 'GET') {
        const page = Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1);
        const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize') ?? 20) || 20));
        const status = url.searchParams.get('status');
        if (status && !STATUSES.includes(status)) return problem(res, 400, 'Bad Request', 'Invalid status');
        const filtered = campaigns
          .filter((c) => !status || c.status === status)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        return json(res, 200, {
          items: filtered.slice((page - 1) * pageSize, page * pageSize),
          page,
          pageSize,
          total: filtered.length,
        });
      }
      if (req.method === 'POST') {
        const body = await readBody(req);
        const errs = validate(body, false);
        if (errs.length) return problem(res, 400, 'Bad Request', errs.join('; '));
        const c = {
          id: `cmp_${randomUUID().slice(0, 8)}`,
          name: body.name,
          status: 'DRAFT',
          dailyBudgetCents: body.dailyBudgetCents,
          maxBidCents: body.maxBidCents,
          keywords: body.keywords ?? [],
          createdAt: new Date().toISOString(),
        };
        campaigns.push(c);
        return json(res, 201, c);
      }
    } else {
      const c = campaigns.find((x) => x.id === id);
      if (!c) return problem(res, 404, 'Not Found', `Campaign ${id} not found`);
      if (sub === 'report' && req.method === 'GET') return json(res, 200, report(c));
      if (!sub && req.method === 'GET') return json(res, 200, c);
      if (!sub && req.method === 'PATCH') {
        const body = await readBody(req);
        const errs = validate(body, true);
        if (errs.length) return problem(res, 400, 'Bad Request', errs.join('; '));
        for (const k of ['name', 'status', 'dailyBudgetCents', 'maxBidCents', 'keywords']) if (k in body) c[k] = body[k];
        return json(res, 200, c);
      }
      if (!sub && req.method === 'DELETE') {
        campaigns = campaigns.filter((x) => x.id !== id);
        res.writeHead(204, cors);
        return res.end();
      }
    }
    return problem(res, 405, 'Method Not Allowed');
  } catch (e) {
    const bad = e.message === 'Malformed JSON';
    return problem(res, bad ? 400 : 500, bad ? 'Bad Request' : 'Internal Server Error', e.message);
  }
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  server.listen(PORT, () => console.log(`AdFlow mock API listening on http://localhost:${PORT}`));
}

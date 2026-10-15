// Performance budget: fail the build when the entry JS or any lazy route chunk grows past its gzip budget.
import { readdirSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const BUDGET_KB = { entry: 110, shared: 45, route: 25 }; // gzip, per file
const dir = 'dist/assets';
let failed = false;
const html = readFileSync('dist/index.html', 'utf8');
for (const f of readdirSync(dir).filter((n) => n.endsWith('.js'))) {
  const kb = gzipSync(readFileSync(`${dir}/${f}`)).length / 1024;
  const isEntry = new RegExp(`<script[^>]+src="/assets/${f}"`).test(html);
  const isShared = new RegExp(`rel="modulepreload"[^>]+href="/assets/${f}"`).test(html);
  const kind = isEntry ? 'entry' : isShared ? 'shared' : 'route';
  const limit = BUDGET_KB[kind];
  const ok = kb <= limit;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${f} ${kb.toFixed(1)} kB gzip (budget ${limit} kB, ${kind})`);
  if (!ok) failed = true;
}
if (failed) process.exit(1);

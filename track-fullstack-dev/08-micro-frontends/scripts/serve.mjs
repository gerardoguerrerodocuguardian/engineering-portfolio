// Serves the three production builds on their fixed ports (shell 5170, campaigns 5171, reports 5172),
// exactly like three independent static deployments. CORS is open because they are different origins.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../apps/', import.meta.url));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const sites = [['shell', 5170, true], ['remote-campaigns', 5171, false], ['remote-reports', 5172, false]];

for (const [name, port, spa] of sites) {
  const dir = join(root, name, 'dist');
  createServer(async (req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    let file = join(dir, path);
    if (!file.startsWith(dir)) { res.writeHead(403).end(); return; }
    try { if ((await stat(file)).isDirectory()) file = join(file, 'index.html'); }
    catch { if (spa && !extname(path)) file = join(dir, 'index.html'); }
    try {
      const body = await readFile(file);
      const cache = file.endsWith('manifest.json') || file.endsWith('remoteEntry.js') || file.endsWith('.html') ? 'no-store' : 'public, max-age=31536000, immutable';
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'access-control-allow-origin': '*', 'cache-control': cache });
      res.end(body);
    } catch { res.writeHead(404, { 'access-control-allow-origin': '*' }).end('not found'); }
  }).listen(port, () => console.log(`${name} on http://localhost:${port}`));
}

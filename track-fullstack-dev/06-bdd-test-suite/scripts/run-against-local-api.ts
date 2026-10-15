/**
 * Starts the sibling API in-memory on a free port, waits for /health, runs a command
 * (default: cucumber-js) against it with BASE_URL set, then stops the API.
 * Usage: tsx scripts/run-against-local-api.ts [cmd args...]
 */
import { spawn } from 'child_process';
import { createServer } from 'net';
import { join } from 'path';

const sibling = join(__dirname, '../../02-nestjs-secure-api');

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.listen(0, () => {
      const { port } = s.address() as { port: number };
      s.close(() => resolve(port));
    });
    s.on('error', reject);
  });
}

async function waitForHealth(url: string, ms = 60_000): Promise<void> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`API did not become healthy at ${url}`);
}

async function main(): Promise<void> {
  const port = await freePort();
  const baseUrl = `http://localhost:${port}`;
  const api = spawn('node', ['-r', 'ts-node/register', 'launcher/start-api.ts'], {
    cwd: join(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(port),
      NODE_PATH: join(sibling, 'node_modules'),
      TS_NODE_PROJECT: join(sibling, 'tsconfig.json'),
    },
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  const stop = () => api.kill('SIGTERM');
  process.on('exit', stop);
  try {
    await waitForHealth(`${baseUrl}/health`);
    const [cmd, ...args] = process.argv.slice(2).length ? process.argv.slice(2) : ['npx', 'cucumber-js'];
    const code: number = await new Promise((resolve) => {
      const p = spawn(cmd, args, { stdio: 'inherit', env: { ...process.env, BASE_URL: baseUrl } });
      p.on('exit', (c) => resolve(c ?? 1));
    });
    stop();
    process.exit(code);
  } catch (e) {
    stop();
    console.error(e);
    process.exit(1);
  }
}
void main();

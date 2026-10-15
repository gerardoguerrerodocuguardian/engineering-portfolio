import { buildApp } from './app';

const port = Number(process.env['PORT'] ?? 8787);
const app = await buildApp();
await app.listen({ port, host: '127.0.0.1' });
console.log(`AdFlow sync server listening on http://127.0.0.1:${port}`);

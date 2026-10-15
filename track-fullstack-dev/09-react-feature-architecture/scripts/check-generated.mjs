// Fails when src/api/schema.d.ts is stale relative to the shared OpenAPI contract.
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const out = join(mkdtempSync(join(tmpdir(), 'adflow-')), 'schema.d.ts');
execFileSync('npx', ['openapi-typescript', '../../shared/contracts/campaign-api.openapi.yaml', '-o', out], { stdio: 'ignore' });
if (readFileSync(out, 'utf8') !== readFileSync('src/api/schema.d.ts', 'utf8')) {
  console.error('src/api/schema.d.ts is out of date. Run: npm run gen:types');
  process.exit(1);
}
console.log('generated types match the contract');

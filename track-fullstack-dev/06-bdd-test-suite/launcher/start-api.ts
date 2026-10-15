/**
 * Boots the sibling NestJS API (../02-nestjs-secure-api) with its InMemoryCampaignRepository.
 *
 * The sibling project has no env flag for this (main.ts always uses MongoDB), and it must not be
 * modified, so this launcher composes the same pieces main.ts + app.setup.ts use, but calls
 * AppModule.register('memory'). Nest dependencies resolve from the sibling's node_modules via
 * NODE_PATH (set by scripts/run-against-local-api.ts / the Makefile), so only one copy of Nest loads.
 */
import 'reflect-metadata';
import { join } from 'path';

const api = join(__dirname, '../../02-nestjs-secure-api/src');

async function main(): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { NestFactory } = require('@nestjs/core');
  const { AppModule } = require(join(api, 'app.module'));
  const { configureApp } = require(join(api, 'app.setup'));

  // Suite-friendly default: do not let the global limiter interfere with a test run.
  process.env.RATE_LIMIT_MAX ??= '100000';
  const port = parseInt(process.env.PORT ?? '3000', 10);

  const app = await NestFactory.create(AppModule.register('memory'), { logger: ['error', 'warn'] });
  configureApp(app);
  await app.listen(port);
  console.log(`AdFlow API (in-memory repository) listening on http://localhost:${port}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

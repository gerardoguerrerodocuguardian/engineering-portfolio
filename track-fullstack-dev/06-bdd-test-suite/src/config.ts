import { readFileSync } from 'fs';
import { join } from 'path';
import { parse } from 'yaml';

export const config = {
  baseUrl: (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, ''),
  // Synthetic dev-issuer users of the AdFlow API (not real credentials).
  admin: {
    username: process.env.ADMIN_USER ?? 'admin@adflow.test',
    password: process.env.ADMIN_PASSWORD ?? 'change-me-admin',
  },
  advertiser: {
    username: process.env.ADVERTISER_USER ?? 'advertiser@adflow.test',
    password: process.env.ADVERTISER_PASSWORD ?? 'change-me-adv',
  },
  contractPath:
    process.env.CONTRACT_PATH ?? join(__dirname, '../../../shared/contracts/campaign-api.openapi.yaml'),
};

export function loadContract(): Record<string, any> {
  return parse(readFileSync(config.contractPath, 'utf8'));
}

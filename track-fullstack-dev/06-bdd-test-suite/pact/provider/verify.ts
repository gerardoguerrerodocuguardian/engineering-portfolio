/**
 * OPTIONAL: verifies the generated pact against a running provider.
 *   make pact-verify        (boots the in-memory API, runs this)
 *   BASE_URL=... npm run test:pact:verify   (any running instance)
 * State handlers seed data through the public API; a requestFilter injects a real token because
 * the consumer pact only carries a placeholder Authorization header.
 */
import { join } from 'path';
import { Verifier } from '@pact-foundation/pact';
import { ApiClient } from '../../src/api-client';
import { config } from '../../src/config';

const api = new ApiClient();
let token = '';

async function main(): Promise<void> {
  const login = await api.login(config.admin.username, config.admin.password);
  token = login.body.access_token;

  const output = await new Verifier({
    provider: 'adflow-campaign-api',
    providerBaseUrl: config.baseUrl,
    pactUrls: [join(__dirname, '../../pacts/adflow-dashboard-adflow-campaign-api.json')],
    logLevel: 'warn',
    requestFilter: (req: any, _res: any, next: () => void) => {
      req.headers['authorization'] = `Bearer ${token}`;
      next();
    },
    stateHandlers: {
      'at least one campaign exists': async () => {
        await api.createCampaign(token, { name: 'Pact Seed', dailyBudgetCents: 1000, maxBidCents: 10 });
      },
      'a campaign exists': async () => {
        const res = await api.createCampaign(token, { name: 'Pact Seed', dailyBudgetCents: 1000, maxBidCents: 10 });
        return { id: res.body.id };
      },
      'no campaign with id 000000000000000000000000 exists': async () => undefined,
    },
  }).verifyProvider();
  console.log(output);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

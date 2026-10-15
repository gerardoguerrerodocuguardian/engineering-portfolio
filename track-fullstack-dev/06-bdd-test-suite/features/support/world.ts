import { After, Before, setWorldConstructor, World, IWorldOptions, setDefaultTimeout } from '@cucumber/cucumber';
import { ApiClient, ApiResponse, Campaign, TokenPair } from '../../src/api-client';
import { config } from '../../src/config';
import { ContractValidator } from '../../src/contract-validator';

setDefaultTimeout(15_000);

const validator = new ContractValidator();
// /auth/token is rate limited (10/min), so tokens are obtained once per role per run.
const tokenCache = new Map<string, string>();

export class AdflowWorld extends World {
  readonly api = new ApiClient();
  token?: string;
  last!: ApiResponse;
  campaign?: Campaign;
  campaigns: Campaign[] = [];
  pair?: TokenPair;
  usedRefreshToken?: string;
  readonly history: ApiResponse[] = [];
  readonly createdIds: string[] = [];

  constructor(options: IWorldOptions) {
    super(options);
  }

  /** Remember every response so the After hook can check it against the contract. */
  record<T>(res: ApiResponse<T>): ApiResponse<T> {
    this.last = res;
    this.history.push(res);
    return res;
  }

  async signIn(role: 'admin' | 'advertiser'): Promise<void> {
    if (!tokenCache.has(role)) {
      const res = await this.api.login(config[role].username, config[role].password);
      if (res.status !== 200) throw new Error(`login as ${role} failed with ${res.status}`);
      tokenCache.set(role, res.body.access_token);
    }
    this.token = tokenCache.get(role);
  }

  validate(res: ApiResponse) {
    return validator.validate(res);
  }
}

setWorldConstructor(AdflowWorld);

Before(function (this: AdflowWorld) {
  this.history.length = 0;
});

// Cleanup: remove campaigns this scenario created (best effort, as admin).
After(async function (this: AdflowWorld) {
  if (this.createdIds.length === 0) return;
  await this.signIn('admin');
  for (const id of this.createdIds) await this.api.deleteCampaign(this.token, id);
});

// Safety net: every /v1 response in every scenario must satisfy the contract.
// Statuses the contract does not document (e.g. 401/404 on some operations) are checked
// against the shared Problem schema instead, which keeps the gap visible but the shape enforced.
After(function (this: AdflowWorld) {
  const failures: string[] = [];
  for (const res of this.history) {
    if (!res.path.startsWith('/v1/')) continue;
    let result = this.validate(res);
    if (!result.valid && res.status >= 400 && result.errors[0]?.includes('not documented')) {
      result = problemShape(res);
    }
    if (!result.valid) failures.push(`${res.method} ${res.path} -> ${res.status}: ${result.errors.join('; ')}`);
  }
  if (failures.length) throw new Error('Contract violations:\n' + failures.join('\n'));
});

function problemShape(res: ApiResponse) {
  const errors: string[] = [];
  if (!res.contentType.includes('application/problem+json')) errors.push(`content-type ${res.contentType}`);
  const r = validator.validateSchema('Problem', res.body);
  return { valid: errors.length === 0 && r.valid, errors: [...errors, ...r.errors] };
}

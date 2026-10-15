import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CAMPAIGN_STATUSES } from './types';

const yaml = readFileSync(join(__dirname, '../../../../shared/contracts/campaign-api.openapi.yaml'), 'utf8');

describe('contract drift guard (hand-mirrored types vs OpenAPI)', () => {
  it('has the same CampaignStatus values', () => {
    const match = /CampaignStatus:\s*\n\s*type: string\s*\n\s*enum: \[([^\]]+)\]/.exec(yaml);
    expect(match).not.toBeNull();
    expect(match![1]!.split(',').map((s) => s.trim())).toEqual([...CAMPAIGN_STATUSES]);
  });

  it.each([
    ['Campaign', 'id, name, status, dailyBudgetCents, maxBidCents, createdAt'],
    ['CampaignReport', 'campaignId, impressions, clicks, spendCents, ctr'],
  ])('%s keeps its required fields', (schema, fields) => {
    const re = new RegExp(`    ${schema}:\\s*\\n\\s*type: object\\s*\\n\\s*required: \\[([^\\]]+)\\]`);
    expect(re.exec(yaml)![1]).toBe(fields);
  });
});

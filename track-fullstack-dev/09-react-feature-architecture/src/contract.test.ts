// @vitest-environment node
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { handledOperations } from '@/mocks/handlers';

describe('MSW handlers vs shared OpenAPI contract', () => {
  it('has a mock handler for every operation in the contract (and no invented ones)', () => {
    const spec = parse(readFileSync('../../shared/contracts/campaign-api.openapi.yaml', 'utf8')) as {
      paths: Record<string, Record<string, unknown>>;
    };
    const methods = ['get', 'post', 'put', 'patch', 'delete'];
    const fromContract = Object.entries(spec.paths).flatMap(([path, item]) => Object.keys(item).filter((k) => methods.includes(k)).map((m) => `${m} ${path}`));
    expect([...handledOperations].sort()).toEqual(fromContract.sort());
  });
});

import { describe, expect, it } from 'vitest';
import { satisfies } from './semver';

describe('satisfies', () => {
  it.each([
    ['18.3.1', '^18.3.1', true], ['18.4.0', '^18.3.1', true], ['19.0.0', '^18.3.1', false], ['18.2.0', '^18.3.1', false],
    ['1.2.9', '~1.2.3', true], ['1.3.0', '~1.2.3', false], ['0.2.5', '^0.2.1', true], ['0.3.0', '^0.2.1', false],
    ['2.0.0', '>=1.0.0', true], ['1.0.0', '2.0.0', false], ['9.9.9', '*', true], ['x', '^1.0.0', false],
  ])('%s vs %s -> %s', (v, r, ok) => expect(satisfies(v, r)).toBe(ok));
});

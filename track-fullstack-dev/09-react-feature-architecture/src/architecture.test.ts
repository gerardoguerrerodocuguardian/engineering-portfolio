// @vitest-environment node
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

/**
 * Proves the architecture rule actually fires: we lint in-memory snippets that
 * pretend to live at a given path and import across layers.
 */
const eslint = new ESLint({ cwd: process.cwd() });

async function violations(filePath: string, code: string) {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? []).filter((m) => m.ruleId?.startsWith('boundaries/'));
}

describe('architecture boundaries', () => {
  it('forbids a feature from importing another feature', async () => {
    const v = await violations('src/features/campaigns/bad.ts', "import { reportQuery } from '@/features/reports/api';\nexport const x = reportQuery;\n");
    expect(v).toHaveLength(1);
    expect(v[0]?.ruleId).toBe('boundaries/dependencies');
  });

  it('also forbids it via a relative path', async () => {
    const v = await violations('src/features/reports/bad.ts', "import { loginSchema } from '../auth/auth';\nexport const x = loginSchema;\n");
    expect(v).toHaveLength(1);
  });

  it('allows a feature to import its own files and shared code', async () => {
    const ok = "import { campaignKeys } from './api';\nimport { api } from '@/api/client';\nimport { Field } from '@/components/Field';\nexport const x = [campaignKeys, api, Field];\n";
    expect(await violations('src/features/campaigns/ok.ts', ok)).toHaveLength(0);
  });

  it('forbids shared code from importing a feature', async () => {
    const v = await violations('src/components/bad.ts', "import { signOut } from '@/features/auth';\nexport const x = signOut;\n");
    expect(v).toHaveLength(1);
  });

  it('forbids a feature from importing the app layer', async () => {
    const v = await violations('src/features/auth/bad.ts', "import { Layout } from '@/app/Layout';\nexport const x = Layout;\n");
    expect(v).toHaveLength(1);
  });

  it('lets the app layer compose features', async () => {
    const ok = "import { signOut } from '@/features/auth';\nimport * as c from '@/features/campaigns';\nexport const x = [signOut, c];\n";
    expect(await violations('src/app/ok.ts', ok)).toHaveLength(0);
  });
});

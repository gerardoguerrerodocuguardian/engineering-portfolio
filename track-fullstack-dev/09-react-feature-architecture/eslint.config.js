import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import boundaries from 'eslint-plugin-boundaries';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import globals from 'globals';

/**
 * Architecture rule (see README):
 *   app      -> may import features and shared
 *   features -> may import shared and ITSELF only (never another feature)
 *   shared   -> may import shared only (never features or app)
 * Exported so the rule can be exercised in tests (src/architecture.test.ts).
 */
export const boundariesConfig = {
  plugins: { boundaries },
  settings: {
    'import/resolver': { typescript: { project: './tsconfig.json' } },
    'boundaries/elements': [
      { type: 'app', pattern: 'src/app/**', partialMatch: false },
      { type: 'feature', pattern: 'src/features/*', capture: ['feature'], partialMatch: false },
      { type: 'feature', pattern: 'src/features/*/**', capture: ['feature'], partialMatch: false },
      { type: 'shared', pattern: ['src/api/**', 'src/components/**', 'src/lib/**', 'src/i18n/**', 'src/mocks/**'], partialMatch: false },
    ],
    'boundaries/ignore': ['**/*.test.{ts,tsx}', 'src/test/**', 'src/main.tsx'],
  },
  rules: {
    'boundaries/dependencies': [
      'error',
      {
        default: 'disallow',
        policies: [
          { from: { element: { type: 'app' } }, allow: { to: { element: { type: ['app', 'feature', 'shared'] } } } },
          { from: { element: { type: 'feature' } }, allow: { to: { element: { type: 'shared' } } } },
          // a feature may import files of ITSELF only
          {
            from: { element: { type: 'feature' } },
            allow: { to: { element: { type: 'feature', captured: { feature: '{{ from.captured.feature }}' } } } },
          },
          { from: { element: { type: 'shared' } }, allow: { to: { element: { type: 'shared' } } } },
        ],
      },
    ],
  },
};

export default tseslint.config(
  { ignores: ['dist', 'public', 'playwright-report', 'test-results', 'src/api/schema.d.ts'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
    },
  },
  { files: ['src/**/*.{ts,tsx}'], ...boundariesConfig },
  { files: ['scripts/**/*.mjs'], languageOptions: { globals: globals.node } },
);

import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const config = [
  ...nextVitals,
  ...nextTs,
  { ignores: ['.next/**', 'node_modules/**', 'coverage/**', 'test-results/**', 'next-env.d.ts', 'src/lib/campaigns/api.generated.ts'] },
];

export default config;

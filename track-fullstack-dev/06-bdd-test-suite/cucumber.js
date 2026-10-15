// Base URL and everything else come from env vars (see src/config.ts).
module.exports = {
  default: {
    paths: ['features/**/*.feature'],
    requireModule: ['tsx/cjs'],
    require: ['features/support/**/*.ts', 'features/step_definitions/**/*.ts'],
    format: [
      'progress',
      'html:reports/cucumber-report.html',
      'json:reports/cucumber-report.json',
    ],
  },
};

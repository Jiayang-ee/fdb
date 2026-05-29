import { defineConfig } from '@playwright/test';

export default defineConfig({
  testMatch: '**/dca-rule-card-retest.ts',
  testIgnore: ['**/backtest.test.ts', '**/fund.test.ts'],
  use: {
    headless: true,
  },
  reporter: [['list']],
});
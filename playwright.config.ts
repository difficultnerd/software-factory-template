import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: process.env.DEPLOY_URL || 'https://software-factory-api.jnewburrie.workers.dev',
    extraHTTPHeaders: {
      'Accept': 'application/json',
    },
  },
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
  ],
});

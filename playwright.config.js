import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  outputDir: process.env.LUMEN_TEST_OUTPUT || 'test-results',
  timeout: 45000,
  expect: { timeout: 10000 },
  use: { baseURL: 'http://127.0.0.1:4179', browserName: 'chromium', trace: 'retain-on-failure' },
  webServer: {
    command: 'pnpm exec lumen serve --host 127.0.0.1 --port 4179',
    url: 'http://127.0.0.1:4179',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});

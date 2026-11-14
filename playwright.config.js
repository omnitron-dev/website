import { defineConfig } from '@playwright/test';

const port = Number(process.env.LUMEN_TEST_PORT ?? 4179);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('LUMEN_TEST_PORT must be an integer from 1 to 65535');
const baseURL = process.env.LUMEN_TEST_BASE_URL || `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: './tests',
  outputDir: process.env.LUMEN_TEST_OUTPUT || 'test-results',
  timeout: 45000,
  expect: { timeout: 10000 },
  use: { baseURL, browserName: 'chromium', trace: 'retain-on-failure' },
  webServer: process.env.LUMEN_TEST_BASE_URL ? undefined : {
    command: `pnpm exec lumen serve --host 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 30000,
  },
});

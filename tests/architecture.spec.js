import { expect, test } from '@playwright/test';

test('architecture distinguishes unknown state from stopped applications and supports keyboard navigation', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/docs/omnitron/architecture');
  const model = page.getByRole('region', { name: 'Resident execution scenarios' });
  await model.scrollIntoViewIfNeeded();
  const normal = model.getByRole('tab', { name: 'Normal operation' });
  await expect(normal).toBeEnabled();
  await normal.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  const backend = model.getByRole('tabpanel', { name: 'Backend update' });
  await expect(backend).toBeVisible();
  await expect(backend.getByRole('row', { name: /Applications/ })).toContainText('Running');
  await model.getByRole('tab', { name: 'Owner update' }).click();
  await expect(model.getByRole('tabpanel', { name: 'Owner update' }).getByRole('row', { name: /Applications/ })).toContainText('Restarted');
  await model.getByRole('tab', { name: 'Lost connection' }).click();
  await expect(model.getByRole('tabpanel', { name: 'Lost connection' }).getByText('Not observed', { exact: true })).toHaveCount(5);
  expect(errors).toEqual([]);
});

test('privacy and architecture remain readable at 320px without client JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false, viewport: { width: 320, height: 820 } });
  try {
    const page = await context.newPage();
    for (const path of ['/docs/foundations/privacy', '/docs/omnitron/architecture', '/docs/foundations/architecture', '/docs/omnitron/studio', '/docs/omnitron/agent-harness', '/docs/omnitron/workflow-runtime', '/']) {
      const response = await page.goto(path);
      expect(response.ok()).toBe(true);
      await expect(page.locator('h1')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    }
    await page.goto('/docs/omnitron/architecture');
    await expect(page.getByRole('heading', { name: 'Read the execution card in Console' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Resident execution scenarios' }).getByText('Guardian', { exact: true })).toBeVisible();
  } finally { await context.close(); }
});

test('the first screen explains the full stack and data ownership without third-party requests', async ({ page, baseURL }) => {
  const external = new Set();
  page.on('request', request => {
    if (new URL(request.url()).origin !== new URL(baseURL).origin) external.add(request.url());
  });
  await page.goto('/');
  await expect(page.getByText('A full-stack platform. On your terms.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Privacy by architecture' })).toHaveAttribute('href', '/docs/foundations/privacy');
  await page.getByRole('link', { name: 'Privacy by architecture' }).click();
  await expect(page.locator('h1')).toHaveText('Your system. Your boundary.');
  expect([...external]).toEqual([]);
});


test('architecture and design diagrams render through Lumen without page overflow', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const route of ['/docs/foundations/privacy', '/docs/foundations/architecture', '/docs/omnitron/architecture', '/docs/omnitron/studio', '/docs/omnitron/agent-harness', '/docs/omnitron/workflow-runtime']) {
    await page.goto(route);
    const diagrams = page.locator('[data-component="MermaidDiagram"]');
    expect(await diagrams.count()).toBeGreaterThan(0);
    for (const diagram of await diagrams.all()) {
      await diagram.scrollIntoViewIfNeeded();
      await expect(diagram.locator('svg')).toBeVisible();
      await expect(diagram.getByRole('alert')).toHaveCount(0);
    }
    await diagrams.first().scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440);
    await page.screenshot({ path: testInfo.outputPath(route.replaceAll('/', '-') + '.png') });
  }
  await page.goto('/docs/omnitron/architecture');
  const model = page.getByRole('region', { name: 'Resident execution scenarios' });
  await model.scrollIntoViewIfNeeded();
  await expect(model.getByRole('tab', { name: 'Normal operation' })).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath('runtime-model-desktop.png') });
  await page.setViewportSize({ width: 320, height: 820 });
  await model.scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  const table = model.getByRole('table');
  expect(await table.evaluate(element => element.scrollWidth)).toBeLessThanOrEqual(await table.evaluate(element => element.parentElement.clientWidth));
  await page.screenshot({ path: testInfo.outputPath('runtime-model-mobile.png') });
  expect(errors).toEqual([]);
});

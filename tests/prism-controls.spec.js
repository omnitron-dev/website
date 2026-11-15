import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const route = '/docs/frontend/prism/components';

async function example(page, name) {
  const marker = page.locator('[data-component="PrismExample"]').and(page.locator(`[data-props*='"example":"${name}"']`));
  await marker.scrollIntoViewIfNeeded();
  const result = page.locator(`[data-example="${name}"]`);
  await expect(result).toBeVisible();
  return result;
}

test('alert examples start valid and show a validation error only after an explicit action', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(route);
  const feedback = await example(page, 'alert');
  await expect(feedback.getByRole('alert')).toContainText('Configuration valid');
  await expect(feedback.getByText('Example validation error', { exact: true })).toHaveCount(0);
  await feedback.getByRole('button', { name: 'Show validation error' }).click();
  await expect(feedback.getByRole('alert')).toContainText('Example validation error');
  await feedback.getByRole('button', { name: 'Restore valid example' }).click();
  await expect(feedback.getByRole('alert')).toContainText('Configuration valid');
  expect(errors).toEqual([]);
});

test('sort and select actual table rows, then read the compiled example source', async ({ page }) => {
  await page.goto(route);
  const table = await example(page, 'table');
  const first = table.getByRole('row').nth(1);
  await expect(first).toContainText('beta');
  await table.getByRole('button', { name: /Latency/ }).click();
  await expect(first).toContainText('alpha');
  await first.getByRole('checkbox').check();
  await expect(table.getByRole('status')).toHaveText('1 selected');
  await table.getByText('Source code', { exact: true }).click();
  const source = await readFile(new URL('../src/site/examples/table.tsx', import.meta.url), 'utf8');
  await expect.poll(() => table.locator('pre > code').textContent()).toBe(source);
});

test('submit typed form values and cancel or confirm a draft change', async ({ page }) => {
  await page.goto(route);
  const form = await example(page, 'field');
  await form.getByRole('textbox', { name: /Service name/ }).fill('Collector');
  await form.getByRole('button', { name: 'Save service' }).click();
  await expect(form.getByRole('status')).toHaveText('Collector is enabled');
  const draft = await example(page, 'confirm-dialog');
  await draft.getByRole('button', { name: 'Archive draft' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Keep draft' }).click();
  await expect(draft.getByRole('status')).toHaveText('Draft in progress');
  await draft.getByRole('button', { name: 'Archive draft' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Archive', exact: true }).click();
  await expect(draft.getByRole('status')).toHaveText('Draft archived');
});

test('route previews use keyboard actions without pretending to navigate to a real page', async ({ page }) => {
  await page.goto(route);
  for (const [name, title] of [['navigation-progress', 'Route progress preview'], ['scroll-to-top', 'Scroll restoration preview']]) {
    const preview = await example(page, name);
    await preview.getByRole('button', { name: 'Load example', exact: true }).click();
    const frame = page.frameLocator(`iframe[title="${title}"]`);
    const next = frame.getByRole('button', { name: 'Open Analysis', exact: true });
    await expect(next).toBeVisible();
    await expect(frame.getByRole('link', { name: 'Open Analysis', exact: true })).toHaveCount(0);
    await next.press('Enter');
    await expect(frame.locator('header')).toHaveText('Analysis');
    await frame.getByRole('button', { name: 'Open Measurements', exact: true }).press('Space');
    await expect(frame.locator('header')).toHaveText('Measurements');
    if (name === 'scroll-to-top') await expect.poll(() => frame.locator('body').evaluate(() => window.scrollY)).toBe(0);
  }
});


test('ordinary previews and source remain readable without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto(route);
    const alert = page.locator('[data-example="alert"]');
    await expect(alert.getByRole('alert')).toContainText('Configuration valid');
    await expect(alert.getByRole('button', { name: 'Show validation error' })).toBeDisabled();
    const table = page.locator('[data-example="table"]');
    await expect(table.getByRole('row').nth(1)).toContainText('beta');
    await table.getByText('Source code', { exact: true }).click();
    const source = await readFile(new URL('../src/site/examples/table.tsx', import.meta.url), 'utf8');
    await expect(table.locator('pre > code')).toHaveText(source);
  } finally { await context.close(); }
});

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

import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const route = '/docs/frontend/prism/components';

async function loadExample(page, name) {
  await page.goto(route);
  const host = page.locator(`article [data-component="PrismExample"][data-props*='"example":"${name}"']`);
  await host.scrollIntoViewIfNeeded();
  const example = page.locator(`article [data-example="${name}"]`);
  await expect(example).toHaveCount(1);
  await example.getByRole('button', { name: 'Load example' }).click();
  await example.getByText('Source code', { exact: true }).click();
  const source = await readFile(new URL(`../src/site/examples/${name}.tsx`, import.meta.url), 'utf8');
  await expect.poll(() => example.locator('pre code.language-tsx, pre.language-tsx > code').first().textContent()).toBe(source);
  return example;
}

test('the research report links to its result and saves a changed source snapshot', async ({ page }) => {
  const report = await loadExample(page, 'research-document');
  await report.getByRole('link', { name: 'Result', exact: true }).click();
  await expect(page).toHaveURL(/#.+/);
  await expect(report.getByText('21 ms', { exact: true })).toBeVisible();

  const editor = await loadExample(page, 'research-editor');
  await editor.getByRole('button', { name: 'Document source' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('textarea').first().fill('## Revised observation\n\nMedian reached 24 ms.');
  await dialog.getByRole('button', { name: 'Apply' }).click();
  await editor.getByRole('button', { name: 'Save snapshot' }).click();
  await editor.getByText('Saved Markdown', { exact: true }).click();
  await expect(editor.locator('details pre').filter({ hasText: 'Median reached 24 ms.' })).toBeVisible();
});

test('the knowledge graph finds evidence and the offline map selects a point', async ({ page, baseURL }) => {
  const graph = await loadExample(page, 'knowledge-graph');
  await graph.getByRole('searchbox').fill('Median');
  const entity = graph.getByRole('button', { name: /Median latency/i });
  await entity.click();
  await expect(entity).toHaveAttribute('aria-current', 'true');

  const external = [];
  page.on('request', request => {
    if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== new URL(baseURL).origin) {
      external.push(request.url());
    }
  });
  const map = await loadExample(page, 'map');
  const clear = map.getByRole('button', { name: 'Clear sample point' });
  await clear.click();
  await expect(clear).toBeDisabled();
  await map.getByRole('button', { name: 'Select map center' }).click();
  await expect(clear).toBeEnabled();
  expect(external).toEqual([]);
});

test('the rich editor renders its document and the chart switches observations', async ({ page }) => {
  const editor = await loadExample(page, 'editor');
  await editor.locator('[contenteditable="true"]').fill('Verified observation');
  await expect(editor.getByRole('region', { name: 'Rendered document' })).toContainText('Verified observation');

  const chart = await loadExample(page, 'chart');
  await expect(chart.locator('svg.apexcharts-svg')).toBeVisible();
  await chart.getByRole('button', { name: 'Show 95th percentile' }).click();
  await expect(chart.locator('output')).toContainText('30, 34, 35');
});

test('the carousel changes slides and the gallery responds to arrow keys and Escape', async ({ page }) => {
  const carousel = await loadExample(page, 'carousel');
  const previous = carousel.getByRole('button', { name: 'Previous slide' });
  await expect(previous).toBeDisabled();
  await carousel.getByRole('button', { name: 'Next slide' }).click();
  await expect(previous).toBeEnabled();

  const gallery = await loadExample(page, 'lightbox');
  await gallery.getByRole('button', { name: 'Open Filled symbol' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(dialog.getByRole('img', { name: 'Omnitron outlined symbol' }).first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
});

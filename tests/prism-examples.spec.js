import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const route = '/docs/frontend/prism/components';

async function loadExample(page, name, path = route) {
  await page.goto(path);
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

const blocksRoute = '/docs/frontend/prism/blocks';
const mapsRoute = '/docs/frontend/prism/maps';

test('the blocks guide validates a local form and expands real observations', async ({ page }) => {
  const login = await loadExample(page, 'auth-login', blocksRoute);
  const writes = [];
  page.on('request', request => {
    if (!['GET', 'HEAD'].includes(request.method())) writes.push(request.url());
  });
  const submit = login.getByRole('button', { name: 'Validate locally' });
  await submit.click();
  await expect(login.getByText('Password is required', { exact: true })).toBeVisible();
  await login.getByRole('textbox', { name: 'Demo email' }).fill('reader@example.test');
  await login.getByLabel('Sample password', { exact: true }).fill('demo-only');
  await submit.click();
  await expect(login.getByRole('alert')).toHaveText('Demo form validated locally.');
  await login.getByRole('button', { name: 'Try again' }).click();
  await expect(login.getByRole('textbox', { name: 'Demo email' })).toHaveValue('');
  expect(writes).toEqual([]);

  const dashboard = await loadExample(page, 'dashboard-block', blocksRoute);
  await expect(dashboard.locator('output')).toHaveText('Run 1: 21 ms');
  await dashboard.getByRole('button', { name: 'Collapse observations' }).click();
  await expect(dashboard.locator('output')).not.toBeVisible();
  await dashboard.getByRole('button', { name: 'Expand observations' }).click();
  await dashboard.getByRole('button', { name: 'Next observation' }).click();
  await expect(dashboard.locator('output')).toHaveText('Run 2: 18 ms');
});

test('the blocks guide filters all data-grid pages and selects the matching row', async ({ page }) => {
  const grid = await loadExample(page, 'data-grid-block', blocksRoute);
  await expect(grid.getByRole('gridcell', { name: 'North platform' })).toBeVisible();
  await grid.getByRole('searchbox', { name: 'Filter stations' }).fill('South');
  await expect(grid.getByRole('gridcell', { name: 'North platform' })).toHaveCount(0);
  await grid.getByRole('gridcell', { name: 'South platform' }).click();
  await expect(grid.locator('output')).toHaveText('Selected station: South platform');
});

test('the maps guide selects local places, opens a custom marker and filters rendered station coverage', async ({ page, baseURL }) => {
  const external = [];
  page.on('request', request => {
    if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== new URL(baseURL).origin) {
      external.push(request.url());
    }
  });
  const search = await loadExample(page, 'map-place-search', mapsRoute);
  const query = search.getByRole('combobox', { name: 'Station name' });
  await query.fill('East');
  await search.getByRole('button', { name: 'Find station' }).click();
  await expect(page.getByRole('option', { name: 'East platform' })).toBeVisible();
  await query.press('ArrowDown');
  await query.press('Enter');
  await expect(search.locator('output')).toHaveText('East platform: 51.506, 0.017');

  const marker = await loadExample(page, 'map-marker', mapsRoute);
  await marker.getByRole('button', { name: 'Inspect reference station' }).press('Enter');
  await expect(marker.locator('.maplibregl-popup')).toContainText('Zero meridian · 51.500° N');

  const coverage = await loadExample(page, 'map-coverage', mapsRoute);
  const result = coverage.locator('output');
  await expect(result).toHaveText('Station A, Station B');
  const canvas = coverage.locator('canvas.maplibregl-canvas');
  const { width, height } = await canvas.boundingBox();
  // Station B falls 50px east and 28px north of the initial center at zoom 11.
  const position = { x: width / 2 + 50, y: height / 2 - 28 };
  await expect(async () => {
    await canvas.click({ position });
    await expect(result).toHaveText('Station B', { timeout: 1000 });
  }).toPass({ timeout: 8000 });
  await coverage.getByRole('button', { name: 'Active stations only' }).click();
  await expect(result).toHaveText('Station A');
  expect(external).toEqual([]);
});

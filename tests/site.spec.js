import { test, expect } from '@playwright/test';

for (const width of [320, 768, 1440]) {
  for (const mode of ['dark', 'light']) {
    test(`home and documentation at ${width}px in ${mode}`, async ({ page }, testInfo) => {
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.setViewportSize({ width, height: 1000 });
      await page.addInitScript(value => localStorage.setItem('omnitron-theme', value), mode);
      for (const [name, route] of [['home', '/'], ['guide', '/docs/lumen/this-site']]) {
        const response = await page.goto(route);
        expect(response.status()).toBe(200);
        await expect(page.locator('.omnitron-site')).toHaveAttribute('data-omnitron-theme', mode);
        await expect(page.locator('h1')).toHaveCount(1);
        await page.evaluate(() => document.fonts.ready);
        await expect(page.locator('.brand .MuiTypography-root')).toHaveCSS('color', mode === 'dark' ? 'rgb(230, 237, 240)' : 'rgb(22, 32, 38)');
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        const bottomGap = await page.evaluate(() => document.documentElement.scrollHeight - document.querySelector('.site-colophon').getBoundingClientRect().bottom - window.scrollY);
        expect(bottomGap).toBeLessThan(2);
        await page.screenshot({ path: testInfo.outputPath(`${name}-${width}-${mode}.png`), fullPage: true });
      }
      expect(errors).toEqual([]);
    });
  }
}

test('theme toggle updates shared identity and mobile section navigation works', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/docs/lumen/this-site');
  await page.getByRole('button', { name: 'Switch color theme' }).click();
  await expect(page.locator('.brand .MuiTypography-root')).toHaveCSS('color', 'rgb(22, 32, 38)');
  await page.locator('.mobile-document-nav > summary').click();
  await page.getByRole('navigation', { name: 'Mobile documentation sections' }).getByRole('link', { name: 'Authoring with Lumen' }).click();
  await expect(page).toHaveURL(/\/docs\/lumen\/authoring$/);
});

test('Pagefind queries the generated local index and follows a real document', async ({ page }) => {
  const responses = [];
  page.on('response', response => { if (response.url().includes('/pagefind/')) responses.push(response); });
  await page.goto('/');
  await page.getByRole('button', { name: 'Search', exact: false }).click();
  const dialog = page.getByRole('dialog', { name: 'Search documentation' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Semantic AI' })).toHaveCount(0);
  await dialog.getByRole('searchbox', { name: 'Search query' }).fill('circuit breaker');
  const first = dialog.locator('.lumen-search-result-link').first();
  await expect(first).toBeVisible();
  expect(responses.some(response => response.url().includes('wasm.en.pagefind') && response.ok())).toBe(true);
  expect(responses.filter(response => !response.ok())).toEqual([]);
  const target = await first.getAttribute('href');
  await first.click();
  await expect(page).toHaveURL(new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  await expect(page.locator('h1')).toBeVisible();
});

test('API explorer is a working React island with canonical guide links', async ({ page }) => {
  await page.goto('/docs/reference/api-index');
  const explorer = page.getByRole('region', { name: 'Public API explorer' });
  await expect(explorer).toBeVisible();
  await explorer.getByLabel('Search API').fill('OmnitronMark');
  const row = explorer.locator('li').filter({ has: page.getByText('OmnitronMark', { exact: true }) });
  await expect(row).toHaveCount(1);
  const guide = row.getByRole('link', { name: 'Guide →' }).first();
  await expect(guide).toHaveAttribute('href', '/docs/frontend/prism/theme');
  await guide.click();
  await expect(page.locator('h1')).toBeVisible();
});

test('visible playground uses its compiled worker and recovers after a deadline', async ({ page }) => {
  const workers = [];
  page.on('worker', worker => workers.push(worker.url()));
  await page.goto('/docs/lumen/authoring');
  const island = page.locator('[data-component="Playground"]');
  await island.scrollIntoViewIfNeeded();
  const playground = page.locator('.lumen-netron-playground');
  await expect(playground).toBeVisible();
  await playground.getByRole('button', { name: 'Run code' }).click();
  await expect(playground.locator('.lumen-playground-result')).toContainText('2,');
  await expect(playground.locator('.lumen-playground-result')).toContainText('6');
  expect(workers.some(url => url.includes('/assets/'))).toBe(true);
  await playground.getByRole('textbox').fill('while (true) {}');
  await playground.getByRole('button', { name: 'Run code' }).click();
  await expect(playground.locator('.lumen-playground-error')).toContainText(/timed out|interrupted/i);
  await playground.getByRole('textbox').fill('return 21 * 2');
  await playground.getByRole('button', { name: 'Run code' }).click();
  await expect(playground.locator('.lumen-playground-result')).toHaveText('42');
});

test('Mermaid source activates the real diagram engine in the production client', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/docs/lumen/authoring');
  const diagram = page.locator('[data-component="MermaidDiagram"]').first();
  await diagram.scrollIntoViewIfNeeded();
  await expect(diagram.locator('svg')).toBeVisible();
  await expect(diagram.locator('svg .node')).toHaveCount(5);
  // Mermaid wraps a label into adjacent SVG tspans without text-node spaces.
  await expect(diagram.locator('svg .node').filter({ hasText: /Document\s*source/ })).toHaveCount(1);
  await expect(diagram.locator('svg .node').filter({ hasText: /Markdown\s*mirror/ })).toHaveCount(1);
  await expect(diagram.getByRole('alert')).toHaveCount(0);
  await diagram.getByText('Diagram source', { exact: true }).click();
  await expect(diagram.locator('pre')).toContainText('flowchart LR');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.screenshot({ path: testInfo.outputPath('diagram-320-dark.png') });
  const viewport = diagram.locator('.lumen-diagram-content');
  const scroll = await viewport.evaluate(element => { element.scrollLeft = element.scrollWidth; return element.scrollLeft; });
  expect(scroll).toBeGreaterThan(0);
  await page.screenshot({ path: testInfo.outputPath('diagram-320-dark-scrolled.png') });
});

test('generated type annotations and math remain readable in the document', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 900 });
  const response = await page.goto('/docs/lumen/authoring');
  const html = await response.text();
  expect(html).toContain('number[]');
  expect(html).toContain('katex-mathml');
  const annotation = page.locator('.lumen-twoslash-popup');
  await expect(annotation).toContainText('number[]');
  await expect(annotation).toBeVisible();
  const formula = page.locator('.katex-display .katex-html');
  await formula.scrollIntoViewIfNeeded();
  await expect(formula).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => [...document.fonts].some(font => font.family.includes('KaTeX') && font.status === 'loaded'))).toBe(true);
  const token = page.locator('.shiki span[style*="--shiki-dark"]').first();
  const darkColor = await token.evaluate(element => getComputedStyle(element).color);
  await page.screenshot({ path: testInfo.outputPath('authoring-320-dark.png') });
  await page.getByRole('button', { name: 'Switch color theme' }).click();
  await expect.poll(() => token.evaluate(element => getComputedStyle(element).color)).not.toBe(darkColor);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.screenshot({ path: testInfo.outputPath('authoring-320-light.png') });
});

import { expect, test } from '@playwright/test';

async function example(page, name) {
  const host = page.locator(`article [data-component="PrismExample"][data-props*='"example":"${name}"']`);
  await host.scrollIntoViewIfNeeded();
  const preview = page.locator(`article [data-example="${name}"]`);
  await expect(preview).toBeVisible();
  return preview;
}

for (const width of [1440, 390]) {
  test(`prose does not restyle live Prism tables and cards at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/docs/frontend/prism/components');
    const preview = await example(page, 'table');
    const table = preview.getByRole('table');
    await expect(table).toBeVisible();
    // Block display shrinks the row group to its content width instead of
    // distributing columns across the component's available table width.
    await expect(table).toHaveCSS('display', 'table');
    await expect(table).toHaveCSS('margin-top', '0px');
    const dimensions = await table.evaluate(element => ({
      table: element.getBoundingClientRect().width,
      row: element.querySelector('tbody tr').getBoundingClientRect().width,
    }));
    expect(Math.abs(dimensions.table - dimensions.row)).toBeLessThan(2);
    await expect(table.getByRole('columnheader').first()).toHaveCSS('border-left-width', '0px');

    const card = await example(page, 'card');
    await expect(card.getByText('Queued builds', { exact: true })).toHaveCSS('margin-top', '0px');
    await expect(card.getByText('Queued builds', { exact: true })).toHaveCSS('margin-bottom', '0px');
    await card.getByRole('button', { name: 'Queue build' }).click();
    await expect(card.getByText('4', { exact: true })).toBeVisible();

    // The same stylesheet must still format ordinary Markdown tables.
    await page.goto('/docs/frontend/prism/state');
    const proseTable = page.locator('article > table').first();
    await expect(proseTable).toHaveCSS('display', 'block');
    await expect(proseTable).toHaveCSS('overflow-x', 'auto');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

for (const width of [320, 1440]) {
  for (const mode of ['light', 'dark']) {
    test(`shared example frame and prose scale at ${width}px in ${mode}`, async ({ page }, testInfo) => {
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.setViewportSize({ width, height: 1000 });
      await page.addInitScript(value => localStorage.setItem('omnitron-theme', value), mode);
      await page.goto('/docs/frontend/prism');
      await expect(page.locator('html')).toHaveAttribute('data-prism-color-scheme', mode);
      await expect(page.locator('.lumen-admonition-tip .lumen-admonition-title')).toHaveText('React 19 + MUI v9 idioms');
      const preview = await example(page, 'tabs');
      await expect(preview.getByRole('tabpanel')).toHaveText('2 connected nodes');
      const prose = page.locator('article.lumen-doc > p').first();
      await expect(prose).toHaveCSS('font-size', '16px');
      await expect(preview.getByRole('tabpanel')).toHaveCSS('font-size', '16px');
      const figure = preview.getByRole('figure', { name: 'Interactive example' });
      await figure.locator('summary').focus();
      await page.keyboard.press('Enter');
      await expect(figure.locator('pre')).toBeVisible();
      await expect(figure.locator('pre code')).toHaveCSS('font-size', '14px');
      await expect(page.locator('article.lumen-doc > pre code').first()).toHaveCSS('font-size', '14px');
      const copy = figure.getByRole('button', { name: 'Copy code', exact: true });
      await copy.focus();
      await expect(copy).toBeFocused();
      await expect(copy).toHaveCSS('outline-style', 'solid');
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await figure.screenshot({ path: testInfo.outputPath(`source-${width}-${mode}.png`) });
      await page.screenshot({ path: testInfo.outputPath(`prism-context-${width}-${mode}.png`) });
      for (const diagram of await page.locator('.lumen-diagram').all()) {
        await diagram.scrollIntoViewIfNeeded();
        await expect(diagram.locator('svg')).toBeVisible();
      }
      await page.keyboard.press('Escape');
      await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
      await page.screenshot({ path: testInfo.outputPath(`prism-${width}-${mode}.png`), fullPage: true });
      expect(errors).toEqual([]);
    });
  }
}

for (const width of [320, 1440]) {
  test(`home and playground inherit the shared code scale at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    const contracts = page.locator('.contract-grid pre code');
    await expect(contracts).toHaveCount(2);
    for (const code of await contracts.all()) await expect(code).toHaveCSS('font-size', '14px');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.goto('/docs/lumen/authoring');
    const host = page.locator('[data-component="Playground"]');
    await host.scrollIntoViewIfNeeded();
    await expect(host.getByRole('textbox')).toHaveCSS('font-size', '14px');
    await host.getByRole('button', { name: 'Run code' }).click();
    await expect(host.locator('.lumen-playground-result')).toHaveCSS('font-size', '14px');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}

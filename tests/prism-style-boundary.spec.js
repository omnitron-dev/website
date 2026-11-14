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

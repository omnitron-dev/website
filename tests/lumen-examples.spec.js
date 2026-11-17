import { expect, test } from '@playwright/test';

test('the source shown in the Lumen guide reproduces the example the reader is using', async ({ page }) => {
  await page.goto('/docs/lumen/authoring');
  const content = page.locator('article.lumen-doc');
  const tree = content.getByRole('figure', { name: 'my-service/' });
  const source = content.locator('pre code').filter({ hasText: ':::filetree{title="my-service/"}' });
  await expect(source).toHaveCount(1);
  for (const name of await tree.locator('.lumen-file-tree-name code').allTextContents()) {
    expect(await source.textContent()).toContain(`\`${name}\``);
  }
  const folder = tree.locator('summary').filter({ hasText: 'src/' });
  await folder.focus();
  await page.keyboard.press('Enter');
  await expect(tree.getByText('main.ts', { exact: true })).toBeHidden();
  await page.keyboard.press('Enter');
  await expect(tree.getByText('main.ts', { exact: true })).toBeVisible();
  const note = content.getByRole('note', { name: '' }).filter({ hasText: 'Keep the contract visible' });
  const noteText = (await note.locator('.lumen-admonition-content').textContent()).trim();
  await expect(content.locator('pre code').filter({ hasText: ':::note{title="Keep the contract visible"}' })).toContainText(noteText);
  const worker = content.locator('[data-component="Playground"]');
  await worker.scrollIntoViewIfNeeded();
  const editor = worker.getByRole('textbox');
  await expect(editor).toBeVisible();
  await expect(content.locator('pre code').filter({ hasText: '<Playground hydrate=' })).toContainText(`code="${await editor.inputValue()}"`);
});

test('public reading formats are durable links with or without interactive tabs', async ({ browser, baseURL }) => {
  for (const javaScriptEnabled of [false, true]) {
    const context = await browser.newContext({ baseURL, javaScriptEnabled, viewport: { width: 320, height: 820 } });
    try {
      const page = await context.newPage();
      await page.goto('/docs/lumen/this-site');
      const group = page.locator('article .lumen-tabs');
      if (javaScriptEnabled) {
        const tabs = group.getByRole('tablist', { name: 'Public reading formats' });
        const first = tabs.getByRole('tab', { name: 'HTML' });
        await first.focus();
        await page.keyboard.press('ArrowRight');
        await expect(tabs.getByRole('tab', { name: 'Markdown' })).toBeFocused();
        await expect(group.getByRole('tabpanel', { name: 'Markdown' })).toBeVisible();
        const link = group.getByRole('link', { name: 'authoring guide as Markdown' });
        await expect(link).toHaveAttribute('href', '/docs/lumen/authoring.md');
        const mirror = await page.request.get(await link.getAttribute('href'));
        expect(mirror.ok()).toBe(true);
        expect(await mirror.text()).toMatch(/^# Authoring with Lumen$/m);
        await page.keyboard.press('End');
        await expect(group.getByRole('link', { name: 'agent index' })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
      } else {
        await expect(group.getByRole('tablist')).toHaveCount(0);
        for (const label of ['HTML', 'Markdown', 'Agent index']) {
          const section = group.getByRole('region', { name: label });
          await expect(section.getByRole('link')).toBeVisible();
          await expect(section.getByRole('heading', { name: label, exact: true })).toBeVisible();
        }
        await page.goto('/docs/lumen/overview');
        const tree = page.getByRole('figure', { name: 'Engineering manual' });
        await expect(tree.getByText('lumen.config.ts', { exact: true })).toBeVisible();
        await tree.locator('summary').focus();
        await page.keyboard.press('Enter');
        await expect(tree.getByText('intro.md', { exact: true })).toBeHidden();
      }
    } finally { await context.close(); }
  }
});

test('the Lumen pipeline explorer exposes captured checks and a working React interaction', async ({ page }) => {
  await page.goto('/docs/lumen/architecture');
  const explorer = page.locator('[data-example="lumen-pipeline"] [data-lumen-explorer]');
  await explorer.scrollIntoViewIfNeeded();
  const stages = explorer.getByRole('tablist', { name: 'Lumen pipeline stage' });
  await stages.getByRole('tab', { name: '3 · Verify', exact: true }).click();
  await expect(explorer.getByText('Both gates passed for the captured corpus.', { exact: true })).toBeVisible();
  await explorer.getByRole('tablist', { name: 'Captured verification case' })
    .getByRole('tab', { name: 'Missing target', exact: true }).click();
  await expect(explorer.getByText('The missing document was rejected by the captured gate run.', { exact: true })).toBeVisible();

  await stages.getByRole('tab', { name: '6 · Activate', exact: true }).click();
  const button = explorer.getByRole('button', { name: 'Record a click', exact: true });
  await expect(button).toBeDisabled();
  await explorer.getByRole('tablist', { name: 'Example interaction mode' })
    .getByRole('tab', { name: 'Interactive component', exact: true }).click();
  await expect(button).toBeEnabled();
  await button.click();
  await expect(explorer.getByRole('status')).toHaveText('Recorded clicks: 1');
});

import { readdir, readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const guide = '/docs/frontend/prism/';
const docs = new URL('../docs/frontend/prism/', import.meta.url);
const directory = new URL('../src/site/examples/', import.meta.url);

test('every Prism example mounts from the same module as its displayed source', async ({ page }) => {
  test.setTimeout(180_000);
  const expected = (await readdir(directory)).filter(file => file.endsWith('.tsx')).sort();
  const shown = new Set();
  for (const guideFile of (await readdir(docs)).filter(file => file.endsWith('.md'))) {
    if (!(await readFile(new URL(guideFile, docs), 'utf8')).includes('<PrismExample ')) continue;
    const route = guideFile === 'index.md' ? '' : guideFile.slice(0, -3);
    await page.goto(route ? guide + route : guide.slice(0, -1));
    const hosts = page.locator('article [data-component="PrismExample"]');
    for (const host of await hosts.all()) {
      const { example } = JSON.parse(await host.getAttribute('data-props'));
      if (shown.has(example)) continue;
      shown.add(example);
      await test.step(example, async () => {
        await host.scrollIntoViewIfNeeded();
        const island = host.locator('[data-example]');
        await expect(island).toHaveAttribute('data-example', example);
        const { deferred } = JSON.parse(await host.getAttribute('data-props'));
        if (deferred === true || deferred === 'true') await island.getByRole('button', { name: 'Load example' }).click();
        const source = island.getByText('Source code', { exact: true });
        await source.click();
        const file = await readFile(new URL(example + '.tsx', directory), 'utf8');
        const code = island.locator('pre code.language-tsx, pre.language-tsx > code').first();
        await expect.poll(() => code.textContent()).toBe(file);
        await source.click();
      });
    }
  }
  expect([...shown].map(name => name + '.tsx').sort()).toEqual(expected);
});

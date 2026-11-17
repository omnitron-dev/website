import { readdir, readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { expect, test } from '@playwright/test';

const output = resolve(import.meta.dirname, '..', process.env.LUMEN_OUT_DIR || 'build');
const directory = new URL('../src/site/examples/', import.meta.url);

test('every registered example mounts from the same module as its displayed source', async ({ page }) => {
  test.setTimeout(180_000);
  const failures = [];
  page.on('pageerror', error => failures.push(error.message));
  page.on('console', message => { if (message.type() === 'error') failures.push(message.text()); });
  const expected = (await readdir(directory)).filter(file => file.endsWith('.tsx')).sort();
  const shown = new Set();
  // Examples also appear outside the Prism guides. Inspect the built HTML
  // generation so page discovery follows emitted routes, including MDX pages.
  for (const file of (await readdir(output, { recursive: true })).filter(file => file.endsWith('.html')).sort()) {
    if (!(await readFile(resolve(output, file), 'utf8')).includes('data-component="PrismExample"')) continue;
    const route = '/' + file.split(sep).join('/').replace(/\.html$/, '').replace(/\/index$/, '');
    await page.goto(route === '/index' ? '/' : route);
    const hosts = page.locator('article [data-component="PrismExample"]');
    for (const host of await hosts.all()) {
      const { example } = JSON.parse(await host.getAttribute('data-props'));
      if (shown.has(example)) continue;
      shown.add(example);
      await test.step(example, async () => {
        await host.scrollIntoViewIfNeeded();
        const island = host.locator(`[data-example="${example}"]`);
        await expect(island).toHaveAttribute('data-example', example);
        const { deferred } = JSON.parse(await host.getAttribute('data-props'));
        if (deferred === true || deferred === 'true') await island.getByRole('button', { name: 'Load example' }).click();
        const source = island.getByText('Source code', { exact: true });
        await source.click();
        const file = await readFile(new URL(example + '.tsx', directory), 'utf8');
        const code = island.locator('pre code.language-tsx, pre.language-tsx > code').first();
        await expect.poll(() => code.textContent()).toBe(file);
        await source.click();
        expect(failures).toEqual([]);
      });
    }
  }
  expect([...shown].map(name => name + '.tsx').sort()).toEqual(expected);
});

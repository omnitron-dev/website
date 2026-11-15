import { test, expect } from '@playwright/test';

test('a delayed preview module retains its readable server content until activation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let release;
  let requested;
  const allowed = new Promise(resolve => { release = resolve; });
  const requestStarted = new Promise(resolve => { requested = resolve; });
  await page.route('**/assets/alert*.js', async route => {
    requested();
    await allowed;
    await route.continue();
  });
  await page.addInitScript(() => {
    window.previewFrames = [];
    const inspect = () => {
      const example = document.querySelector('section[data-example="alert"]');
      if (example) {
        const preview = example.querySelector('.lumen-example-preview');
        window.initialPreview ??= preview;
        window.previewFrames.push({ ready: Boolean(preview), pending: example.textContent.includes('Loading example') });
      }
      requestAnimationFrame(inspect);
    };
    requestAnimationFrame(inspect);
  });
  try {
    await page.goto('/docs/frontend/prism/components', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => document.querySelector('section[data-example="alert"]')?.scrollIntoView());
    await requestStarted;
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const preview = page.locator('section[data-example="alert"]');
    await expect(preview.getByText('Configuration valid', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => window.initialPreview?.isConnected)).toBe(true);
    const frames = await page.evaluate(() => window.previewFrames);
    expect(frames.length).toBeGreaterThan(0);
    for (const frame of frames) expect(frame).toEqual({ ready: true, pending: false });
    release();
    const change = preview.getByRole('button', { name: 'Show validation error', exact: true });
    await expect(change).toBeEnabled();
    await change.click();
    await expect(preview.getByText('Example validation error', { exact: true })).toBeVisible();
    await expect(preview.locator('.lumen-example-preview')).toHaveCount(1);
  } finally {
    release();
  }
});

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


test('server-rendered table sorting stays natively disabled until its handler is ready', async ({ page }) => {
  let release;
  let requested;
  const allowed = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { requested = resolve; });
  await page.route(/\/assets\/table\.[^/]+\.js$/, async route => {
    requested();
    await allowed;
    await route.continue();
  });
  try {
    await page.goto('/docs/frontend/prism/components', { waitUntil: 'domcontentloaded' });
    const preview = page.locator('section[data-example="table"]');
    await preview.scrollIntoViewIfNeeded();
    await started;
    const sort = preview.getByRole('button', { name: /Latency/ });
    await expect(sort).toHaveJSProperty('tagName', 'BUTTON');
    await expect(sort).toHaveAttribute('type', 'button');
    await expect(sort).toBeDisabled();
    expect(await sort.evaluate(element => {
      let clicks = 0;
      element.addEventListener('click', () => { clicks++; }, { once: true });
      element.click();
      return clicks;
    })).toBe(0);
    await expect(preview.getByRole('row').nth(1)).toContainText('beta');
    release();
    await expect(sort).toBeEnabled();
    await expect(sort).toHaveCSS('border-top-width', '0px');
    await sort.press('Enter');
    await expect(preview.getByRole('row').nth(1)).toContainText('alpha');
    await expect(preview.getByRole('columnheader', { name: /Latency/ })).toHaveAttribute('aria-sort', 'descending');
    await sort.press('Space');
    await expect(preview.getByRole('row').nth(1)).toContainText('beta');
  } finally { release(); }
});

test('opening a server source disclosure keeps its state and focus after activation', async ({ page }) => {
  let release;
  let requested;
  const allowed = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { requested = resolve; });
  await page.route(/\/assets\/tabs\.[^/]+\.js$/, async route => {
    requested();
    await allowed;
    await route.continue();
  });
  try {
    await page.goto('/docs/frontend/prism', { waitUntil: 'domcontentloaded' });
    const preview = page.locator('section[data-example="tabs"]');
    await preview.scrollIntoViewIfNeeded();
    await started;
    const disclosure = preview.locator('details');
    const summary = disclosure.locator('summary');
    await summary.focus();
    await summary.press('Enter');
    await expect(disclosure).toHaveAttribute('open');
    await expect(disclosure.locator('pre')).toBeVisible();
    await expect(summary).toBeFocused();
    release();
    await expect(preview.getByRole('button', { name: 'Reset example' })).toBeVisible();
    await expect(disclosure).toHaveAttribute('open');
    await expect(summary).toBeFocused();
    await expect(disclosure.getByRole('button', { name: 'Copy code', exact: true })).toBeVisible();
  } finally { release(); }
});

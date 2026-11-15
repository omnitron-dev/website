import { test, expect } from '@playwright/test';

for (const scripts of ['disabled', 'blocked by CSP']) {
  test(`registered component previews are readable with scripts ${scripts}`, async ({ browser, baseURL }, testInfo) => {
    const context = await browser.newContext({ baseURL, javaScriptEnabled: scripts !== 'disabled', reducedMotion: 'reduce' });
    try {
      const page = await context.newPage();
      if (scripts === 'blocked by CSP') {
        await page.route('**/docs/frontend/prism/components', async route => {
          const response = await route.fetch();
          await route.fulfill({ response, headers: {
            ...response.headers(),
            'content-security-policy': "default-src 'self'; script-src 'none'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:",
          } });
        });
      }
      const response = await page.goto('/docs/frontend/prism/components');
      expect(response.ok()).toBe(true);
      const hosts = page.locator('[data-component="PrismExample"]');
      const immediate = await hosts.evaluateAll(elements => elements.flatMap(element => {
        const props = JSON.parse(element.getAttribute('data-props'));
        return props.deferred === true || props.deferred === 'true' ? [] : [props.example];
      }));
      expect(immediate.length).toBeGreaterThan(30);
      for (const name of immediate) {
        const host = hosts.filter({ has: page.locator(`section[data-example="${name}"]`) });
        await expect(host.locator('.lumen-example-preview')).toBeVisible();
        expect(await host.locator('.lumen-example-preview > *').count()).toBeGreaterThan(0);
        await expect(host.locator('fieldset').first()).toHaveAttribute('disabled', '');
        const control = host.locator('button, input, select, textarea').first();
        if (await control.count()) await expect(control).toBeDisabled();
        await expect(host.locator('figure[data-example] > details > summary')).toHaveText('Source code');
      }
      await expect(page.getByText('Loading example…', { exact: true })).toHaveCount(0);
      await expect(page.locator('template[id^="B:"], [hidden][id^="S:"]')).toHaveCount(0);
      const source = hosts.filter({ has: page.locator(`section[data-example="${immediate[0]}"]`) }).locator('figure[data-example] > details');
      await source.locator('summary').click();
      await expect(source).toHaveAttribute('open', '');
      await expect(source.locator('pre code')).toBeVisible();
      await testInfo.attach('static-previews.json', { body: JSON.stringify({ scripts, examples: immediate }), contentType: 'application/json' });
    } finally {
      await context.close();
    }
  });
}

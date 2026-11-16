import { test, expect } from '@playwright/test';

const fontFiles = ['/fonts/inter-400.woff2', '/fonts/inter-600.woff2'];
const fontPattern = '**/fonts/*.woff2';
const measuredElements = ['.home-hero h1', '.hero-description', '.hero-actions a', '.topology-node strong'];

async function bounds(page) {
  return page.evaluate(selectors => Object.fromEntries(selectors.map(selector => {
    const { x, y, width, height } = document.querySelector(selector).getBoundingClientRect();
    return [selector, { x, y, width, height }];
  })), measuredElements);
}

async function actualHeadingFonts(context, page) {
  const session = await context.newCDPSession(page);
  try {
    await session.send('DOM.enable');
    await session.send('CSS.enable');
    const { root } = await session.send('DOM.getDocument');
    const { nodeId } = await session.send('DOM.querySelector', { nodeId: root.nodeId, selector: '.home-hero h1' });
    const { fonts } = await session.send('CSS.getPlatformFontsForNode', { nodeId });
    return fonts;
  } finally {
    await session.detach();
  }
}

async function settlePaint(session) {
  // Native capture crosses a paint boundary without awaiting the intentionally delayed fonts.
  await session.send('Page.captureScreenshot', { format: 'png' });
}

test.describe('font delivery without JavaScript', () => {
  test.use({ javaScriptEnabled: false, reducedMotion: 'reduce' });

  for (const width of [390, 1440]) {
    test(`late fonts keep the first reading frame stable at ${width}px`, async ({ page, context }) => {
      await page.setViewportSize({ width, height: 1000 });
      let releaseFonts;
      const fontsAllowed = new Promise(resolve => { releaseFonts = resolve; });
      const requested = [];
      const responses = [];
      const session = await context.newCDPSession(page);
      const shifts = [];
      let measureShifts = false;
      session.on('PerformanceTimeline.timelineEvent', ({ event }) => {
        if (measureShifts && event.type === 'layout-shift' && !event.layoutShiftDetails.hadRecentInput) shifts.push(event.layoutShiftDetails.value);
      });
      await session.send('PerformanceTimeline.enable', { eventTypes: ['layout-shift'] });
      page.on('response', response => {
        if (fontFiles.includes(new URL(response.url()).pathname)) responses.push(response);
      });
      await page.route(fontPattern, async route => {
        requested.push(new URL(route.request().url()).pathname);
        await fontsAllowed;
        await route.continue();
      });
      try {
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await expect.poll(() => requested.toSorted()).toEqual(fontFiles);
        await expect(page.locator('.home-hero h1')).toBeVisible();
        const preloads = await page.locator('link[rel="preload"][as="font"]').evaluateAll(links => links.map(link => ({
          href: new URL(link.href).pathname,
          type: link.type,
          crossOrigin: link.crossOrigin,
          beforeMain: Boolean(link.compareDocumentPosition(document.querySelector('main')) & Node.DOCUMENT_POSITION_FOLLOWING),
        })));
        expect(preloads).toEqual(fontFiles.map(href => ({ href, type: 'font/woff2', crossOrigin: 'anonymous', beforeMain: true })));
        expect(await page.evaluate(() => [...document.fonts].filter(font => font.family === 'Inter').map(font => font.display))).toEqual(['optional', 'optional']);
        // Cross the browser's short font block period while the real requests remain pending.
        await page.waitForTimeout(250);
        await settlePaint(session);
        expect((await actualHeadingFonts(context, page)).every(font => !font.isCustomFont)).toBe(true);
        const before = await bounds(page);
        measureShifts = true;
        releaseFonts();
        await expect.poll(() => responses.length).toBe(2);
        await page.evaluate(() => document.fonts.ready);
        await settlePaint(session);
        expect(await bounds(page)).toEqual(before);
        expect(shifts).toEqual([]);
        const delivery = await page.evaluate(paths => ({
          fonts: performance.getEntriesByType('resource').filter(entry => paths.includes(new URL(entry.name).pathname)).map(entry => ({ path: new URL(entry.name).pathname, initiator: entry.initiatorType, startTime: entry.startTime })),
          domContentLoaded: performance.getEntriesByType('navigation')[0].domContentLoadedEventStart,
        }), fontFiles);
        expect(delivery.fonts.map(font => font.path).toSorted()).toEqual(fontFiles);
        for (const font of delivery.fonts) {
          expect(font.initiator).toBe('link');
          expect(font.startTime).toBeLessThan(delivery.domContentLoaded);
        }
        expect((await actualHeadingFonts(context, page)).every(font => !font.isCustomFont)).toBe(true);
        for (const response of responses) {
          expect(response.ok()).toBe(true);
          expect(response.headers()['content-type']).toMatch(/^font\/woff2(?:;|$)/);
          expect((await response.body()).byteLength).toBeGreaterThan(20000);
        }
        // Check successful decoding independently of font selection. With optional,
        // even a later navigation may keep fallback for its entire lifetime.
        // Routing also disables HTTP caching, so reload is not a warm-cache oracle.
        // https://drafts.csswg.org/css-fonts/#valdef-font-face-font-display-optional
        expect(await page.evaluate(() => [...document.fonts]
          .filter(font => font.family === 'Inter')
          .map(font => ({ weight: font.weight, status: font.status }))))
          .toEqual([{ weight: '400', status: 'loaded' }, { weight: '600 900', status: 'loaded' }]);
      } finally {
        releaseFonts();
        await session.detach();
      }
    });
  }
});

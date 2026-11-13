import { test, expect } from '@playwright/test';
import apiIndex from '../src/data/api-index.json' with { type: 'json' };

async function chooseTheme(page, mode) {
  await page.getByRole('button', { name: /^Color theme:/ }).click();
  await page.getByRole('menuitem', { name: new RegExp('^' + mode + '(?: · current)?$') }).click();
  await expect(page.getByRole('menu')).toHaveCount(0);
}

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
        await expect(page.locator('html')).toHaveAttribute('data-omnitron-theme', mode);
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
  await chooseTheme(page, 'Light');
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
  const mark = apiIndex.symbols.find(symbol => symbol.name === 'OmnitronMark');
  expect(mark.source).toMatch(/^packages\/prism\/.+#L\d+$/);
  const sourceBase = `https://github.com/omnitron-dev/omni/blob/${apiIndex.revision}/`;
  await expect(row.getByRole('link', { name: 'Source' })).toHaveAttribute('href', sourceBase + mark.source);
  const stylesheet = apiIndex.entryPoints.find(entry => entry.kind === 'stylesheet');
  await explorer.getByText('Browse all package entry points', { exact: true }).click();
  await expect(explorer.locator('details li').filter({ has: page.getByText(stylesheet.path, { exact: true }) })
    .getByRole('link', { name: 'Source' })).toHaveAttribute('href', sourceBase + stylesheet.source);
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
  await page.addInitScript(() => localStorage.setItem('omnitron-theme', 'dark'));
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
  await chooseTheme(page, 'Light');
  await expect.poll(() => token.evaluate(element => getComputedStyle(element).color)).not.toBe(darkColor);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.screenshot({ path: testInfo.outputPath('authoring-320-light.png') });
});


test('header identity unfolds on hover and keyboard focus and respects reduced motion', async ({ page }, testInfo) => {
  await page.goto('/docs/intro');
  const brand = page.getByRole('link', { name: 'Omnitron home' });
  const facet = brand.locator('[data-facet]').first();
  const transform = () => facet.evaluate(element => getComputedStyle(element).transform);
  await expect.poll(transform).toBe('none');
  await brand.hover();
  await expect.poll(transform).not.toBe('none');
  await facet.evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished)));
  await page.screenshot({ path: testInfo.outputPath('header-hover.png') });
  await page.mouse.move(700, 300);
  await expect.poll(transform).toBe('none');
  await page.getByRole('link', { name: 'Skip to content' }).focus();
  await page.keyboard.press('Tab');
  await expect(brand).toBeFocused();
  expect(await brand.evaluate(element => element.matches(':focus-visible'))).toBe(true);
  await expect.poll(transform).not.toBe('none');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(transform).toBe('none');
  await brand.hover();
  await expect.poll(transform).toBe('none');
});

for (const width of [320, 1440]) {
  test(`pagination keeps document direction at ${width}px with either neighbor absent`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    for (const [route, previous, next] of [['/docs/intro', false, true], ['/docs/lumen/authoring', true, true], ['/docs/lumen/this-site', true, false]]) {
      await page.goto(route);
      const pagination = page.getByRole('navigation', { name: 'Docs pagination' });
      await pagination.scrollIntoViewIfNeeded();
      const bounds = await pagination.boundingBox();
      const prev = pagination.locator('.lumen-pagination-prev');
      const forward = pagination.locator('.lumen-pagination-next');
      await expect(prev).toHaveCount(previous ? 1 : 0);
      await expect(forward).toHaveCount(next ? 1 : 0);
      if (previous) {
        expect((await prev.boundingBox()).x).toBeCloseTo(bounds.x, 0);
        const arrow = await prev.locator('.lumen-pagination-arrow').boundingBox();
        const label = await prev.locator('.lumen-pagination-label').boundingBox();
        expect(arrow.x + arrow.width).toBeLessThan(label.x);
      }
      if (next) {
        expect((await forward.boundingBox()).x).toBeGreaterThan(bounds.x + bounds.width / 2);
        const arrow = await forward.locator('.lumen-pagination-arrow').boundingBox();
        const label = await forward.locator('.lumen-pagination-label').boundingBox();
        expect(label.x + label.width).toBeLessThan(arrow.x);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      if (route === '/docs/intro') await page.screenshot({ path: testInfo.outputPath(`pagination-${width}.png`) });
    }
  });
}

test('category landing pages sit between their previous document and first child', async ({ page }) => {
  for (const [route, previous, firstChild] of [
    ['/docs/tutorial', '/docs/getting-started/project-structure', '/docs/tutorial/scaffold'],
    ['/docs/titan/netron', '/docs/titan/errors/classification', '/docs/titan/netron/services'],
    ['/docs/frontend/prism', '/docs/frontend/overview', '/docs/frontend/prism/components'],
  ]) {
    await page.goto(route);
    const pagination = page.getByRole('navigation', { name: 'Docs pagination' });
    await expect(pagination.locator('.lumen-pagination-prev')).toHaveAttribute('href', previous);
    await expect(pagination.locator('.lumen-pagination-next')).toHaveAttribute('href', firstChild);
    await pagination.locator('.lumen-pagination-next').click();
    await expect(page).toHaveURL(new RegExp(firstChild + '$'));
    await expect(page.locator('.lumen-pagination-prev')).toHaveAttribute('href', route);
  }
});

test('system theme follows OS changes while explicit choices persist', async ({ page }, testInfo) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/docs/intro');
  const shell = page.locator('html');
  const button = page.getByRole('button', { name: /^Color theme:/ });
  await expect(button).toHaveAccessibleName('Color theme: System');
  await expect(shell).toHaveAttribute('data-omnitron-theme', 'dark');
  await expect(button.locator('svg')).toHaveAttribute('data-theme-icon', 'system');
  await chooseTheme(page, 'System');
  await expect(button).toBeFocused();
  await chooseTheme(page, 'Light');
  await expect(shell).toHaveAttribute('data-omnitron-theme', 'light');
  await expect(button.locator('svg')).toHaveAttribute('data-theme-icon', 'light');
  await page.reload();
  await expect(button).toHaveAccessibleName('Color theme: Light');
  await page.emulateMedia({ colorScheme: 'light' });
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(shell).toHaveAttribute('data-omnitron-theme', 'light');
  await chooseTheme(page, 'System');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('omnitron-theme'))).toBe('system');
  await expect(shell).toHaveAttribute('data-omnitron-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(shell).toHaveAttribute('data-omnitron-theme', 'light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(shell).toHaveAttribute('data-omnitron-theme', 'dark');
  await page.reload();
  await expect(button).toHaveAccessibleName('Color theme: System');
  await chooseTheme(page, 'Dark');
  await expect(button.locator('svg')).toHaveAttribute('data-theme-icon', 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(shell).toHaveAttribute('data-omnitron-theme', 'dark');
  await button.click();
  await page.screenshot({ path: testInfo.outputPath('theme-options.png') });
  await expect(page.getByRole('menuitem', { name: 'Dark · current' })).toBeVisible();
});

test('theme menu supports keyboard selection, escape and mobile focus return', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/docs/intro');
  const button = page.getByRole('button', { name: /^Color theme:/ });
  await button.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menu')).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Light' })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: 'Dark' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(button).toBeFocused();
  await expect(button).toHaveAccessibleName('Color theme: Dark');
  await page.keyboard.press('Space');
  await expect(page.getByRole('menu')).toBeVisible();
  const menu = await page.getByRole('menu').boundingBox();
  expect(menu.x).toBeGreaterThanOrEqual(0);
  expect(menu.x + menu.width).toBeLessThanOrEqual(320);
  await page.screenshot({ path: testInfo.outputPath('theme-menu-320.png') });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(button).toBeFocused();
  expect(await button.evaluate(element => getComputedStyle(element).outlineStyle)).not.toBe('none');
});

test('home topology explains platform boundaries without a second brand mark', async ({ page }) => {
  await page.goto('/');
  const topology = page.getByRole('complementary', { name: 'From interface to service.' });
  await expect(topology.getByRole('link')).toHaveCount(5);
  await expect(topology.locator('[data-omnitron-mark]')).toHaveCount(0);
  await expect(topology.getByText('Typed RPC', { exact: true })).toBeVisible();
  await expect(topology.getByText('HTTP / WebSocket', { exact: true })).toBeVisible();
  await expect(topology.getByText('Publishes these contracts')).toBeVisible();
  await expect(topology.getByText('Supervises these processes')).toBeVisible();
});


for (const [saved, system, expected, background, text] of [
  ['light', 'dark', 'light', 'rgb(243, 246, 247)', 'rgb(22, 32, 38)'],
  ['dark', 'light', 'dark', 'rgb(11, 15, 18)', 'rgb(230, 237, 240)'],
  ['system', 'light', 'light', 'rgb(243, 246, 247)', 'rgb(22, 32, 38)'],
]) {
  test(`theme prepaint applies ${saved} before client modules load`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: system });
    await page.addInitScript(mode => {
      localStorage.setItem('omnitron-theme', mode);
      new PerformanceObserver(list => {
        if (list.getEntries().some(entry => entry.name === 'first-contentful-paint')) {
          window.__firstThemePaint = {
            mode: document.documentElement.dataset.omnitronTheme,
            background: getComputedStyle(document.querySelector('.omnitron-site')).backgroundColor,
            text: getComputedStyle(document.querySelector('.brand .MuiTypography-root')).color,
          };
        }
      }).observe({ type: 'paint', buffered: true });
    }, saved);
    await page.route('**/*', route => route.request().resourceType() === 'script' ? route.abort() : route.continue());
    await page.goto('/docs/intro');
    await expect.poll(() => page.evaluate(() => window.__firstThemePaint)).toEqual({ mode: expected, background, text });
    await expect(page.locator('h1')).toBeVisible();
  });
}

test('documentation remains readable without JavaScript using the system palette', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false, colorScheme: 'light', viewport: { width: 320, height: 900 } });
  try {
    const page = await context.newPage();
    await page.goto('/docs/intro');
    await expect(page.locator('.omnitron-site')).toHaveCSS('background-color', 'rgb(243, 246, 247)');
    await expect(page.locator('.brand .MuiTypography-root')).toHaveCSS('color', 'rgb(22, 32, 38)');
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Choose color theme' })).toBeDisabled();
    await expect(page.getByRole('button', { name: /^Search/ })).toBeDisabled();
    await page.getByText('In this section', { exact: true }).click();
    await expect(page.getByRole('navigation', { name: 'Mobile documentation sections' })).toBeVisible();
  } finally { await context.close(); }
});


test('the current section follows native anchors and the final short section below the fixed header', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/docs/getting-started/project-structure#single-app-layout');
  const toc = page.locator('.lumen-doc-toc .lumen-section-nav');
  await expect(toc.locator('[aria-current=location]')).toHaveAttribute('href', '#single-app-layout');
  const link = toc.getByRole('link', { name: 'Sharing service types', exact: true });
  await link.focus(); await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#sharing-service-types$/);
  await expect(link).toHaveAttribute('aria-current', 'location');
  expect((await page.locator('#sharing-service-types').boundingBox()).y).toBeGreaterThanOrEqual((await page.locator('.site-header').boundingBox()).height);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect(toc.locator('[aria-current=location]')).toHaveAttribute('href', '#conventions');
});

for (const width of [320, 1440]) {
  test('native file trees preserve long inventories and annotations at ' + width + 'px', async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of ['/docs/getting-started/project-structure', '/docs/foundations/monorepo']) {
      await page.goto(route);
      const tree = page.locator('.lumen-file-tree').first();
      await tree.scrollIntoViewIfNeeded();
      await expect(tree).toBeVisible();
      expect(await tree.locator('li').count()).toBeGreaterThan(8);
      expect(await tree.locator('.lumen-file-tree-description').count()).toBeGreaterThan(1);
      const marker = await tree.locator('svg').first().boundingBox();
      expect(marker.width).toBe(16); expect(marker.height).toBe(16);
      const directory = tree.locator('details').first();
      const summary = directory.locator(':scope > summary');
      await summary.focus(); await page.keyboard.press('Enter');
      await expect(directory).not.toHaveAttribute('open');
      await page.keyboard.press('Space'); await expect(directory).toHaveAttribute('open', '');
      for (const mode of ['Dark', 'Light']) {
        await chooseTheme(page, mode);
        await tree.scrollIntoViewIfNeeded();
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        expect(await tree.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
        await page.evaluate(() => window.scrollTo(0, 0));
        await expect(page.getByRole('menu')).toHaveCount(0);
        await expect.poll(async () => (await page.locator('.site-header').boundingBox()).y).toBe(0);
        await page.screenshot({ path: testInfo.outputPath(route.split('/').at(-1) + '-' + width + '-' + mode + '.png'), fullPage: true });
      }
    }
  });
}

test('nested sidebar guides and active borders share the same inset', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const route of ['/docs/getting-started/project-structure', '/docs/titan/netron/services']) {
    await page.goto(route);
    const active = page.locator('.lumen-doc-sidebar a[aria-current=page]');
    await active.scrollIntoViewIfNeeded();
    const positions = await active.evaluate(element => ({ link: element.getBoundingClientRect().x, guide: element.closest('ul').getBoundingClientRect().x }));
    expect(positions.link).toBeCloseTo(positions.guide, 1);
    await active.focus(); await expect(active).toBeFocused();
  }
  await page.screenshot({ path: testInfo.outputPath('sidebar-alignment-1440.png') });
});

test('homepage contract uses shared dual-theme syntax highlighting without page overflow', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 1000 });
  await page.goto('/');
  await expect(page.locator('.home-hero .eyebrow')).toHaveCount(0);
  await expect(page.locator('.contract-grid pre > code.shiki')).toHaveCount(2);
  const palettes = [];
  for (const mode of ['Dark', 'Light']) {
    await chooseTheme(page, mode);
    await page.locator('#contract-title').scrollIntoViewIfNeeded();
    const colors = await page.locator('.contract-grid .shiki span[style]').evaluateAll(elements => [...new Set(elements.filter(element => element.textContent.trim()).map(element => getComputedStyle(element).color))]);
    expect(colors.length).toBeGreaterThan(3); palettes.push(colors);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    const grid = await page.locator('.contract-grid').boundingBox();
    for (const block of await page.locator('.contract-grid pre').all()) {
      expect(await block.evaluate(element => getComputedStyle(element).overflowX)).toBe('auto');
      expect((await block.boundingBox()).width).toBeLessThanOrEqual(grid.width);
    }
    await page.screenshot({ path: testInfo.outputPath('contract-320-' + mode + '.png') });
  }
  expect(palettes[0]).not.toEqual(palettes[1]);
});


test('the platform topology renders quoted labels in both themes without literal entities', async ({ page }, testInfo) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/docs/omnitron/overview');
  const diagram = page.locator('[data-component="MermaidDiagram"]').first();
  for (const width of [1440, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const mode of ['Dark', 'Light']) {
      await chooseTheme(page, mode); await diagram.scrollIntoViewIfNeeded();
      const svg = diagram.locator('svg'); await expect(svg).toBeVisible();
      await expect(svg).toContainText('Infrastructure (Docker / bare-metal)');
      await expect(svg).toContainText('Omnitron instance (one per node)');
      await expect(diagram.getByRole('alert')).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await page.screenshot({ path: testInfo.outputPath('overview-diagram-' + width + '-' + mode + '.png') });
    }
  }
  expect(errors).toEqual([]);
});

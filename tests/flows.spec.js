import { test, expect } from '@playwright/test';

for (const width of [360, 1280]) {
  test(`a keyboard reader can follow disk recovery from the Studio guide at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 920 });
    await page.goto('/docs/omnitron/studio#team-room');
    await page.getByRole('link', { name: 'Build a disk-space flow' }).click();
    const monitor = page.getByRole('region', { name: 'Recorded disk monitor' });
    await page.locator('[data-component="DiskFlowTrace"]').scrollIntoViewIfNeeded();
    const slider = monitor.getByRole('slider', { name: 'Disk observation' });
    await expect(monitor).toContainText('14 GiB free · No notification');
    await expect(slider).toBeEnabled();
    await slider.press('Home');
    await slider.press('ArrowRight');
    await slider.press('ArrowRight');
    await expect(monitor).toContainText('9 GiB free · Disk space is low');
    await slider.press('ArrowRight');
    await expect(monitor).toContainText('8 GiB free · No notification');
    await slider.press('ArrowRight');
    await slider.press('ArrowRight');
    await expect(monitor).toContainText('12 GiB free · Disk space recovered');
    expect(await monitor.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  });
}

import { expect, test } from '@playwright/test';

/**
 * On phones nothing may be wider than the screen: mobile browsers then zoom the whole page
 * out and stretch fixed bars (a bug the Stickies filters once caused).
 */
test('no screen is wider than a phone', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone layout');
  await page.addInitScript(() => localStorage.setItem('notedoco:installGuideDismissed', 'true'));
  await page.goto('/#/stickies');
  await page.getByRole('button', { name: 'Sticky', exact: true }).click();
  await page.getByRole('textbox', { name: 'Sticky text' }).fill('A fairly long sticky note text to wrap\n- [ ] and a task');
  await page.getByRole('button', { name: 'Done' }).click();
  for (const url of ['/#/today', '/#/tasks', '/#/timeline', '/#/inbox', '/#/stickies', '/#/search?q=task', '/#/tags', '/#/trash', '/#/settings', '/#/lab/ink', '/#/dev']) {
    await page.goto(url);
    await page.waitForTimeout(300);
    const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
    expect(scroll, url).toBeLessThanOrEqual(client);
  }
});

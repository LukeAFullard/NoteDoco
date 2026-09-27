import { expect, test } from '@playwright/test';

test.describe('timeline', () => {
  test.skip(({ isMobile }) => isMobile, 'desktop timeline');

  test('reschedules by keyboard and by dragging, zooms, and switches lanes and orientation', async ({ page }) => {
    await page.goto('/#/today');
    const bar = page.getByRole('textbox', { name: 'Quick add' });
    await bar.fill('Design review tomorrow');
    await bar.press('Enter');
    await expect(page.getByRole('region', { name: 'Coming up' })).toContainText('Design review');

    await page.goto('/#/timeline');
    const card = page.getByRole('button', { name: /^Design review, Tomorrow, Inbox/ });
    await expect(card).toBeVisible();

    // Keyboard: Alt+Right moves it a day later; Undo puts it back.
    await card.focus();
    await page.keyboard.press('Alt+ArrowRight');
    await expect(page.getByRole('status').getByText(/^Moved to /)).toBeVisible();
    const moved = page.getByRole('button', { name: /^Design review, (?!Tomorrow)/ });
    await expect(moved).toBeFocused();
    await page.getByRole('status').getByRole('button', { name: 'Undo' }).last().click();
    await expect(card).toBeVisible();

    // Drag: one day is 160 px at the Days zoom.
    const box = (await card.boundingBox())!;
    await page.mouse.move(box.x + 40, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 120, box.y + box.height / 2, { steps: 5 });
    await page.mouse.move(box.x + 200, box.y + box.height / 2, { steps: 5 });
    await page.mouse.up();
    await expect(page.getByRole('status').getByText(/^Moved to /).last()).toBeVisible();
    await expect(card).toHaveCount(0);

    // Zoom out with the minus key; lanes by colour; columns orientation.
    await page.getByRole('button', { name: /^Design review/ }).focus();
    await page.keyboard.press('-');
    await expect(page.getByRole('combobox', { name: 'Zoom' })).toHaveValue('week');
    await page.getByRole('combobox', { name: 'Lanes by' }).selectOption('colour');
    await expect(page.getByRole('group', { name: 'Lemon' })).toBeVisible();
    await page.getByRole('radio', { name: /Columns/ }).click();
    await expect(page.getByRole('region', { name: 'Timeline, time top to bottom' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Design review/ })).toBeVisible();
  });

  test('double-clicking a lane adds a sticky on that day; lanes can be hidden', async ({ page }) => {
    await page.goto('/#/timeline');
    const inbox = page.getByRole('group', { name: 'Inbox' });
    const lane = inbox.locator('> div').nth(1);
    // The lane is thousands of pixels wide; double-click in the middle of what's on screen.
    const box = (await lane.boundingBox())!;
    const view = (await page.getByRole('region', { name: /^Timeline,/ }).boundingBox())!;
    await page.mouse.dblclick(view.x + view.width / 2, box.y + 20);
    const text = page.getByRole('textbox', { name: 'Sticky text' });
    await expect(text).toBeFocused();
    await text.fill('Dropped in');
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByRole('button', { name: /^Dropped in, / })).toBeVisible();

    await page.getByRole('button', { name: 'Choose lanes' }).click();
    await page.getByRole('dialog').getByRole('checkbox', { name: 'Inbox' }).uncheck();
    await page.getByRole('dialog').getByRole('button', { name: 'Done' }).click();
    await expect(page.getByText('All lanes are hidden.')).toBeVisible();
  });
});

test('phone timeline is a feed of days with lane chips', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone layout');
  await page.goto('/#/today');
  const bar = page.getByRole('textbox', { name: 'Quick add' });
  await bar.fill('Picnic tomorrow');
  await bar.press('Enter');
  await page.goto('/#/timeline');
  await expect(page.getByRole('region', { name: 'Today' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Tomorrow' }).getByRole('link', { name: 'Picnic' })).toBeVisible();
  await page.getByRole('group', { name: 'Show lane' }).getByRole('button', { name: 'Inbox' }).click();
  await expect(page.getByRole('link', { name: 'Picnic' })).toBeVisible();
});

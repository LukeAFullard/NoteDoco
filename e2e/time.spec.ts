import { expect, test } from '@playwright/test';

test.describe('dates', () => {
  test.skip(({ isMobile }) => isMobile, 'keyboard-driven flow');

  test('@date chips, the date dialog with natural language, and repeats', async ({ page }) => {
    await page.goto('/#/inbox');
    await page.keyboard.press('n');
    const editor = page.getByRole('textbox', { name: 'Note', exact: true });
    await expect(editor).toBeFocused();
    await page.keyboard.type('Dentist');
    await page.keyboard.press('Enter');
    await page.keyboard.type('[ ] ring them @tomorrow ');
    await expect(editor.locator('.date-chip')).toHaveAttribute('title', 'Tomorrow');
    await expect(editor).toContainText(/@\d{4}-\d{2}-\d{2}/);

    await page.getByRole('button', { name: 'Add date' }).click();
    const dialog = page.getByRole('dialog', { name: 'Date and repeat' });
    await dialog.getByPlaceholder(/Type a date/).fill('tomorrow 3pm');
    await expect(dialog.getByText(/Press Enter for Tomorrow/)).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(dialog.getByRole('textbox', { name: 'Start time' })).toHaveValue('15:00');
    await dialog.getByRole('combobox', { name: 'Repeat' }).selectOption('WEEKLY');
    await expect(dialog.getByText(/^Weekly on \w+\.$/)).toBeVisible();
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('status').getByText('Date set')).toBeVisible();
    const badge = page.getByRole('button', { name: /Tomorrow, 3:00/ });
    await expect(badge).toContainText('Tomorrow');
    await expect(badge).toContainText('repeats: Weekly');
  });
});

test('Today: quick capture reads dates; ticking a to-do can be undone; Tasks lists checklist lines', async ({ page }) => {
  await page.goto('/#/today');
  const bar = page.getByRole('textbox', { name: 'Quick add' });
  await bar.fill('buy milk');
  await bar.press('Enter');
  await bar.fill('pay rent by tomorrow');
  await expect(page.getByText('“pay rent” · due Tomorrow')).toBeVisible();
  await bar.press('Enter');

  const todaySection = page.getByRole('region', { name: 'Today’s plan' });
  await expect(todaySection.getByRole('link', { name: 'buy milk' })).toBeVisible();
  const comingUp = page.getByRole('region', { name: 'Coming up' });
  await expect(comingUp.getByText('Tomorrow')).toBeVisible();
  await expect(comingUp.getByRole('link', { name: 'pay rent' })).toBeVisible();

  const tick = todaySection.getByRole('checkbox', { name: 'Done: buy milk' });
  await tick.click();
  await expect(tick).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('status').getByRole('button', { name: 'Undo' }).last().click();
  await expect(tick).toHaveAttribute('aria-checked', 'false');

  // A note with a dated checklist line shows on Tasks and can be ticked there.
  await page.goto('/#/new/note');
  const editor = page.getByRole('textbox', { name: 'Note', exact: true });
  await expect(editor).toBeFocused();
  await page.keyboard.type('Launch');
  await page.keyboard.press('Enter');
  await page.keyboard.type('[ ] send invites @today ');
  await expect(page.getByText('Saved', { exact: false })).toBeVisible();
  await page.goto('/#/tasks');
  const today = page.getByRole('region', { name: 'Today' });
  await expect(today.getByRole('link', { name: 'buy milk' })).toBeVisible();
  const line = today.getByRole('checkbox', { name: 'send invites' });
  await line.click();
  await expect(page.getByRole('status').getByText('Ticked')).toBeVisible();
  await expect(line).toBeHidden(); // done tasks are hidden until "Show done"
  await page.getByText('Show done').click();
  await expect(page.getByRole('region', { name: 'Done' }).getByRole('checkbox', { name: 'send invites' })).toHaveAttribute('aria-checked', 'true');
});

test('a reminder goes off in the app, and an item can be added to a calendar (.ics)', async ({ page, isMobile }) => {
  test.skip(isMobile, 'menu-driven flow');
  await page.goto('/#/today');
  const bar = page.getByRole('textbox', { name: 'Quick add' });
  await bar.fill('Call mum');
  await bar.press('Enter');
  const row = page.getByRole('region', { name: 'Today’s plan' }).locator('[data-item-id]').first();
  await row.hover();
  await row.getByRole('button', { name: 'Item actions' }).click();
  await page.getByRole('menuitem', { name: 'Date and repeat…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Date and repeat' });
  await dialog.getByRole('combobox', { name: 'Reminder' }).selectOption('custom');
  // A minute ago: it goes off as soon as it's saved.
  const d = new Date(Date.now() - 60_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  await dialog.getByLabel('Remind me at').fill(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('status').getByText('Reminder: Call mum')).toBeVisible({ timeout: 10_000 });

  await row.hover();
  await row.getByRole('button', { name: 'Item actions' }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: 'Add to calendar (.ics)' }).click()]);
  expect(download.suggestedFilename()).toBe('Call mum.ics');
  const text = await (await download.createReadStream()).toArray().then((c) => Buffer.concat(c).toString());
  expect(text).toContain('SUMMARY:Call mum');
  expect(text).toContain('BEGIN:VALARM');
});

import { expect, test } from '@playwright/test';

const localDate = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

async function add(page: import('@playwright/test').Page, text: string) {
  await page.goto('/#/today');
  const bar = page.getByRole('textbox', { name: 'Quick add' });
  await bar.fill(text);
  await bar.press('Enter');
  await expect(page.getByRole('status').getByText(/^Added/).last()).toBeVisible();
}

test.describe('calendar', () => {
  test.skip(({ isMobile }) => isMobile, 'desktop calendar');

  test('month: Alt+arrow and dragging move an item to another day, with undo', async ({ page }) => {
    await add(page, 'Dentist tomorrow');
    await page.goto(`/#/calendar?view=month&date=${localDate(1)}`);
    const chip = page.getByRole('button', { name: /^Dentist, Tomorrow/ });
    await chip.focus();
    await page.keyboard.press('Alt+ArrowRight');
    await expect(page.getByRole('status').getByText(/^Moved to /)).toBeVisible();
    const later = page.getByRole('button', { name: /^Dentist, / });
    await expect(later).toBeFocused();
    await expect(page.locator(`[data-cal-day="${localDate(2)}"]`).getByRole('button', { name: /^Dentist/ })).toBeVisible();

    // Drag it back to tomorrow's cell (both on screen, toasts out of the way).
    const dismiss = page.getByRole('status').getByRole('button', { name: 'Dismiss' });
    while ((await dismiss.count()) > 0) await dismiss.first().click();
    await page.locator(`[data-cal-day="${localDate(1)}"]`).scrollIntoViewIfNeeded();
    await later.scrollIntoViewIfNeeded();
    const from = (await later.boundingBox())!;
    const to = (await page.locator(`[data-cal-day="${localDate(1)}"]`).boundingBox())!;
    await page.mouse.move(from.x + 10, from.y + 5);
    await page.mouse.down();
    await page.mouse.move(to.x + 30, to.y + 60, { steps: 8 });
    await page.mouse.up();
    await expect(page.locator(`[data-cal-day="${localDate(1)}"]`).getByRole('button', { name: /^Dentist/ })).toBeVisible();
  });

  test('week: drag a timed item an hour later; double-click adds a sticky at that time', async ({ page }) => {
    await add(page, 'Call Sam tomorrow 10am');
    await page.goto(`/#/calendar?view=week&date=${localDate(1)}`);
    const item = page.getByRole('button', { name: /^Call Sam, 10:00/ });
    // Show 9:00 to the afternoon, whatever time the test runs.
    await page.getByRole('region', { name: 'Times of day' }).evaluate((el) => (el.scrollTop = 9 * 48));
    await expect(item).toBeVisible();
    const box = (await item.boundingBox())!;
    await page.mouse.move(box.x + 10, box.y + 5);
    await page.mouse.down();
    await page.mouse.move(box.x + 10, box.y + 30, { steps: 5 });
    await page.mouse.move(box.x + 10, box.y + 53, { steps: 5 });
    await page.mouse.up();
    await expect(page.getByRole('button', { name: /^Call Sam, 11:00/ })).toBeVisible();

    const col = page.locator(`[data-cal-day="${localDate(1)}"][data-cal-px-per-min]`);
    const c = (await col.boundingBox())!;
    const moved = (await page.getByRole('button', { name: /^Call Sam, 11:00/ }).boundingBox())!;
    await page.mouse.dblclick(c.x + c.width / 2, moved.y + 48 * 3); // three hours later, around 14:00
    const text = page.getByRole('textbox', { name: 'Sticky text' });
    await expect(text).toBeFocused();
    await text.fill('Gym');
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByRole('button', { name: /^Gym, 2:00/ })).toBeVisible();
  });
});

test('a dated checklist line shows on the calendar and moves by rewriting its date', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop calendar');
  await page.goto('/#/new/note');
  const editor = page.getByRole('textbox', { name: 'Note', exact: true });
  await expect(editor).toBeFocused();
  await page.keyboard.type('Launch');
  await page.keyboard.press('Enter');
  await page.keyboard.type('[ ] send invites @tomorrow ');
  await expect(page.getByText('Saved', { exact: false })).toBeVisible();
  await page.goto(`/#/calendar?view=month&date=${localDate(1)}`);
  const chip = page.locator(`[data-cal-day="${localDate(1)}"]`).getByRole('button', { name: /^send invites/ });
  await chip.focus();
  await page.keyboard.press('Alt+ArrowRight');
  await expect(page.locator(`[data-cal-day="${localDate(2)}"]`).getByRole('button', { name: /^send invites/ })).toBeVisible();
  await page.goto('/#/tasks');
  await expect(page.getByRole('region', { name: /^(This week|Later)$/ }).getByRole('checkbox', { name: /send invites/ })).toBeVisible();
});

test('phone calendar: month dots and the chosen day’s list', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone layout');
  await add(page, 'Picnic tomorrow');
  await page.goto(`/#/calendar?view=month&date=${localDate(1)}`);
  await expect(page.getByRole('radio', { name: 'Week' })).toHaveCount(0);
  await page.getByRole('button', { name: /, 1 item$/ }).first().click();
  await expect(page.getByRole('link', { name: 'Picnic' })).toBeVisible();
});

import { expect, test } from '@playwright/test';

test.describe('stickies wall', () => {
  test.skip(({ isMobile }) => isMobile, 'clipboard and keyboard flow');

  test('pasting a list makes one sticky per line; filters, meanings and merge work', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/#/stickies');
    await expect(page.getByText('Your sticky wall is empty')).toBeVisible();

    await page.evaluate(() => navigator.clipboard.writeText('- Call Sam\n- Book flights\n- Buy milk'));
    await page.keyboard.press('Control+v');
    await expect(page.locator('[data-item-id]')).toHaveCount(3);
    await expect(page.getByRole('status')).toContainText('Added 3 stickies');

    // Colours cycle, so filtering by one colour shows exactly one of the three.
    await page.getByRole('button', { name: 'Lemon' }).click();
    await expect(page.locator('[data-item-id]')).toHaveCount(1);
    await page.getByRole('button', { name: 'Lemon' }).click();

    // Give lemon a meaning; the filter chip shows it.
    await page.getByRole('button', { name: 'Meanings' }).click();
    await page.getByRole('textbox', { name: 'Meaning of Lemon' }).fill('Idea');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('button', { name: 'Idea', exact: true })).toBeVisible();

    // Select all three and merge them into one note.
    await page.getByRole('checkbox', { name: 'Select Call Sam' }).check({ force: true });
    await page.getByRole('button', { name: 'Select all' }).click();
    await page.getByRole('button', { name: 'Actions for selected items' }).click();
    await page.getByRole('menuitem', { name: 'Merge into one note' }).click();
    const editor = page.getByRole('textbox', { name: 'Note', exact: true });
    await expect(editor).toContainText('Call Sam');
    await expect(editor).toContainText('Buy milk');
  });

  test('ticks a checklist line directly on a sticky', async ({ page }) => {
    await page.goto('/#/stickies');
    await page.keyboard.press('s');
    await page.getByRole('textbox', { name: 'Sticky text' }).fill('Shopping\n- [ ] eggs');
    await page.getByRole('button', { name: 'Done' }).click();
    const box = page.locator('[data-item-id]').getByRole('checkbox', { name: /eggs/ });
    await box.check();
    await expect(box).toBeChecked();
    await page.reload();
    await expect(page.locator('[data-item-id]').getByRole('checkbox', { name: /eggs/ })).toBeChecked();
  });
});

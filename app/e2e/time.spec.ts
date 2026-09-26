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

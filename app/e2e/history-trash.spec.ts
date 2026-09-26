import { expect, test } from '@playwright/test';

test.describe('history and trash', () => {
  test.skip(({ isMobile }) => isMobile, 'keyboard-driven flow');

  test('restores an earlier version of a note', async ({ page }) => {
    await page.goto('/#/inbox');
    await page.keyboard.press('n');
    const editor = page.getByRole('textbox', { name: 'Note', exact: true });
    await expect(editor).toBeFocused();
    await page.keyboard.type('First draft');
    await expect(page.getByText('Saved', { exact: false })).toBeVisible();
    // Leaving the note saves a version.
    await page.goto('/#/inbox');
    await page.locator('[data-item-id] a').first().click();
    await editor.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type('Second draft');
    await expect(page.getByText('Saved', { exact: false })).toBeVisible();

    await page.getByRole('button', { name: 'Version history' }).click();
    const dialog = page.getByRole('dialog', { name: 'Version history' });
    await expect(dialog).toContainText('First draft');
    await dialog.getByRole('button', { name: 'Restore this version' }).click();
    await expect(editor).toHaveText('First draft');
    await expect(page.getByRole('status').last()).toContainText('Restored an earlier version');
  });

  test('trash, restore, and delete forever with confirmation', async ({ page }) => {
    await page.goto('/#/inbox');
    for (const t of ['keep me', 'lose me']) {
      await page.keyboard.press('s');
      await page.getByRole('textbox', { name: 'Sticky text' }).fill(t);
      await page.getByRole('button', { name: 'Done' }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }
    await page.getByRole('checkbox', { name: 'Select keep me' }).check({ force: true });
    await page.getByRole('checkbox', { name: 'Select lose me' }).check({ force: true });
    await page.getByRole('button', { name: 'Actions for selected items' }).click();
    await page.getByRole('menuitem', { name: 'Move to Trash' }).click();
    await expect(page.locator('[data-item-id]')).toHaveCount(0);

    await page.goto('/#/trash');
    await page.getByRole('listitem').filter({ hasText: 'keep me' }).getByRole('button', { name: 'Restore' }).click();
    await page.getByRole('button', { name: /Delete “lose me” forever/ }).click();
    await page.getByRole('button', { name: 'Delete forever' }).click();
    await expect(page.getByText('Trash is empty')).toBeVisible();
    await page.goto('/#/inbox');
    await expect(page.locator('[data-item-id]')).toHaveCount(1);
    await expect(page.locator('[data-item-id]')).toContainText('keep me');
  });
});

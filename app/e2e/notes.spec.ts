import { expect, test } from '@playwright/test';

test.describe('notes', () => {
  test.skip(({ isMobile }) => isMobile, 'keyboard-driven flow');

  test('N creates a note; Markdown shortcuts format it; it saves and shows in the Inbox', async ({ page }) => {
    await page.goto('/#/inbox');
    await page.keyboard.press('n');
    const editor = page.getByRole('textbox', { name: 'Note', exact: true });
    await expect(editor).toBeFocused();
    await page.keyboard.type('# Groceries');
    await page.keyboard.press('Enter');
    await page.keyboard.type('[ ] milk');
    await page.keyboard.press('Enter');
    await page.keyboard.type('eggs #food');
    await expect(editor.locator('h1')).toHaveText('Groceries');
    await expect(editor.locator('ul[data-type="taskList"] li')).toHaveCount(2);
    await expect(page.getByText('Saved', { exact: false })).toBeVisible();

    await page.goto('/#/inbox');
    const row = page.locator('[data-item-id]').first();
    await expect(row).toContainText('Groceries');
    await expect(row.getByLabel('0 of 2 done')).toBeVisible();
    await expect(row).toContainText('#food');

    // Reopen: content survived.
    await row.getByRole('link').click();
    await expect(page.getByRole('textbox', { name: 'Note', exact: true }).locator('h1')).toHaveText('Groceries');
  });

  test('slash menu inserts a table; source mode shows the Markdown', async ({ page }) => {
    await page.goto('/#/inbox');
    await page.keyboard.press('n');
    await expect(page.getByRole('textbox', { name: 'Note', exact: true })).toBeFocused();
    await page.keyboard.type('Plan');
    await page.keyboard.press('Enter');
    await page.keyboard.type('/tab');
    await expect(page.getByRole('option', { name: /Table/ })).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('textbox', { name: 'Note', exact: true }).locator('table')).toBeVisible();
    await page.getByRole('button', { name: 'Edit as Markdown' }).click();
    await expect(page.getByRole('textbox', { name: 'Markdown source' })).toHaveValue(/^Plan\n+\| +\|/);
  });

  test('find and replace', async ({ page }) => {
    await page.goto('/#/inbox');
    await page.keyboard.press('n');
    await expect(page.getByRole('textbox', { name: 'Note', exact: true })).toBeFocused();
    await page.keyboard.type('one fish two fish');
    await page.keyboard.press('Control+f');
    await page.getByRole('textbox', { name: 'Find in note' }).fill('fish');
    await expect(page.getByText('1/2')).toBeVisible();
    await page.getByRole('textbox', { name: 'Replace with' }).fill('cat');
    await page.getByRole('button', { name: 'All', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Note', exact: true })).toHaveText('one cat two cat');
  });
});

test.describe('stickies and bulk actions', () => {
  test.skip(({ isMobile }) => isMobile, 'keyboard-driven flow');

  test('S opens a new sticky; closing an empty one discards it', async ({ page }) => {
    await page.goto('/#/inbox');
    await page.keyboard.press('s');
    await page.getByRole('textbox', { name: 'Sticky text' }).fill('Call Sam');
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.locator('[data-item-id]')).toHaveCount(1);
    await expect(page.locator('[data-item-id]')).toContainText('Call Sam');

    await page.keyboard.press('s');
    await expect(page.getByRole('textbox', { name: 'Sticky text' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('[data-item-id]')).toHaveCount(1);
  });

  test('select several items and trash them, then undo', async ({ page }) => {
    await page.goto('/#/inbox');
    for (const t of ['one', 'two', 'three']) {
      await page.keyboard.press('s');
      await page.getByRole('textbox', { name: 'Sticky text' }).fill(t);
      await page.getByRole('button', { name: 'Done' }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }
    await expect(page.locator('[data-item-id]')).toHaveCount(3);
    await page.getByRole('checkbox', { name: 'Select one' }).check({ force: true });
    await page.getByRole('checkbox', { name: 'Select three' }).check({ force: true });
    await expect(page.getByText('2 selected')).toBeVisible();
    await page.getByRole('button', { name: 'Actions for selected items' }).click();
    await page.getByRole('menuitem', { name: 'Move to Trash' }).click();
    await expect(page.locator('[data-item-id]')).toHaveCount(1);
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.locator('[data-item-id]')).toHaveCount(3);
  });
});

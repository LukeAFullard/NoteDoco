import { expect, test, type Page } from '@playwright/test';

async function newGroup(page: Page, name: string) {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'New group' }).click();
  await page.getByRole('textbox', { name: 'Name' }).fill(name);
  await page.getByRole('button', { name: 'Create group' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(name);
}

async function newSticky(page: Page, text: string) {
  await page.keyboard.press('s');
  const box = page.getByRole('textbox', { name: 'Sticky text' });
  await expect(box).toBeFocused();
  await box.fill(text);
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

test.describe('side by side', () => {
  test.skip(({ isMobile }) => isMobile, 'wide screens');
  test.use({ viewport: { width: 1400, height: 900 } });

  test('split view: a second pane with its own history; drag an item into a group in the other pane', async ({ page }) => {
    await page.goto('/#/inbox');
    await newGroup(page, 'Work');
    await page.goto('/#/inbox');
    await newSticky(page, 'Draft agenda');

    // Open the Inbox beside, then open Work in the main view.
    await page.getByRole('button', { name: 'Open this beside (split view)' }).click();
    const side = page.locator('[data-pane-id]:not([data-pane-id="main"])');
    await expect(side.getByRole('heading', { level: 1 })).toHaveText('Inbox');
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Work' }).click();
    const main = page.locator('[data-pane-id="main"]');
    await expect(main.getByRole('heading', { level: 1 })).toContainText('Work');

    // Drag the sticky from the side pane into Work.
    await side.locator('[data-item-id]').first().dragTo(main.getByText('Nothing in Work yet'));
    await expect(page.getByRole('status').getByText('Moved item to Work')).toBeVisible();
    await expect(main.locator('[data-item-id]')).toHaveCount(1);

    // The side pane navigates on its own, with back and forward.
    await side.getByRole('button', { name: 'Back (in this pane)' }).isDisabled();
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Inbox' }).click({ modifiers: ['Shift'] });
    await expect(side.getByRole('heading', { level: 1 })).toHaveText('Inbox');
    await side.getByRole('button', { name: 'Close this pane' }).click();
    await expect(side).toHaveCount(0);
    await expect(main.getByRole('heading', { level: 1 })).toContainText('Work');
  });

  test('groups side by side: drag between columns; the inspector moves an item too', async ({ page }) => {
    await page.goto('/#/inbox');
    await newGroup(page, 'Home');
    await page.goto('/#/inbox');
    await newSticky(page, 'Call plumber');
    await page.goto('/#/columns');
    const inbox = page.getByRole('region', { name: 'Inbox' });
    const home = page.getByRole('region', { name: 'Home' });
    await expect(inbox.locator('[data-item-id]')).toHaveCount(1);
    await inbox.locator('[data-item-id]').first().dragTo(home.getByText('Nothing here.'));
    await expect(page.getByRole('status').getByText('Moved item to Home')).toBeVisible();
    await expect(home.locator('[data-item-id]')).toHaveCount(1);

    // Open a note with the inspector and move it with the Group picker.
    await page.goto('/#/new/note');
    await expect(page.getByRole('textbox', { name: 'Note', exact: true })).toBeFocused();
    await page.keyboard.type('Boiler notes');
    await page.getByRole('button', { name: 'Show the inspector' }).click();
    const inspector = page.getByRole('complementary', { name: 'Inspector' });
    await inspector.getByRole('combobox', { name: 'Group' }).selectOption({ label: 'Home' });
    await expect(page.getByRole('status').getByText('Moved item to Home')).toHaveCount(2);
    await expect(page.getByRole('link', { name: 'Back to Home' })).toBeVisible();
    await expect(inspector.getByText('Words')).toBeVisible();
  });
});

test.describe('a note open beside another view', () => {
  test.skip(({ isMobile }) => isMobile, 'wide screens');
  test.use({ viewport: { width: 1400, height: 900 } });

  test('ticking its checklist elsewhere shows in the note, and typing there keeps the tick', async ({ page }) => {
    await page.goto('/#/new/note');
    const editor = page.getByRole('textbox', { name: 'Note', exact: true });
    await expect(editor).toBeFocused();
    await page.keyboard.type('Plan');
    await page.keyboard.press('Enter');
    await page.keyboard.type('[ ] call Sam');
    await expect(page.getByText('Saved', { exact: false })).toBeVisible();

    // Tasks beside the note: tick the line there.
    await page.getByRole('button', { name: 'Open this beside (split view)' }).click();
    const side = page.locator('[data-pane-id]:not([data-pane-id="main"])');
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Tasks' }).click({ modifiers: ['Shift'] });
    await expect(side.getByRole('heading', { level: 1 })).toHaveText('Tasks');
    await side.getByRole('checkbox', { name: 'call Sam' }).click();

    // The note in the main pane shows the tick; typing more there doesn't undo it.
    const main = page.locator('[data-pane-id="main"]');
    const box = main.locator('ul[data-type="taskList"] input[type="checkbox"]');
    await expect(box).toBeChecked();
    await main.getByRole('textbox', { name: 'Note', exact: true }).click();
    await page.keyboard.press('Control+End');
    await page.keyboard.type(' today');
    await expect(main.getByText('Saved', { exact: false })).toBeVisible();
    await page.reload();
    await expect(page.locator('[data-pane-id="main"] ul[data-type="taskList"] input[type="checkbox"]')).toBeChecked();
  });
});

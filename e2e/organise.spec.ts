import { expect, test, type Page } from '@playwright/test';

async function newGroup(page: Page, name: string) {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'New group' }).click();
  await page.getByRole('textbox', { name: 'Name' }).fill(name);
  await page.getByRole('button', { name: 'Create group' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(name);
}

const sidebarGroup = (page: Page, name: string) => page.getByRole('list', { name: 'Groups' }).getByRole('link', { name });

test.describe('organising', () => {
  test.skip(({ isMobile }) => isMobile, 'drag and drop with a mouse');

  test('drag a note onto a group; drag a group into another to nest it', async ({ page }) => {
    await page.goto('/#/inbox');
    await newGroup(page, 'Work');
    await newGroup(page, 'Launch');
    await page.goto('/#/inbox');
    await page.keyboard.press('n');
    await expect(page.getByRole('textbox', { name: 'Note', exact: true })).toBeFocused();
    await page.keyboard.type('Spec draft');
    await page.goto('/#/inbox');

    await page.locator('[data-item-id]').first().dragTo(sidebarGroup(page, 'Work'));
    await expect(page.getByRole('status')).toContainText('Moved item to Work');
    await expect(page.locator('[data-item-id]')).toHaveCount(0);

    await sidebarGroup(page, 'Launch').dragTo(sidebarGroup(page, 'Work'));
    await expect(page.getByRole('status').last()).toContainText('Group moved');
    await sidebarGroup(page, 'Work').click();
    await expect(page.getByRole('navigation', { name: 'Sub-groups' })).toContainText('Launch');
    await expect(page.locator('[data-item-id]')).toContainText('Spec draft');
  });

  test('tag a note, find it under Tags, and rename the tag', async ({ page }) => {
    await page.goto('/#/inbox');
    await page.keyboard.press('n');
    await expect(page.getByRole('textbox', { name: 'Note', exact: true })).toBeFocused();
    await page.keyboard.type('Quarterly plan #work');
    await page.getByRole('combobox', { name: 'Add a tag' }).fill('urgent');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Remove tag urgent' })).toBeVisible();

    await page.goto('/#/tags');
    await page.getByRole('link', { name: /#work/ }).click();
    await expect(page.locator('[data-item-id]')).toContainText('Quarterly plan');
    await page.getByRole('button', { name: 'Rename or merge' }).click();
    await page.getByRole('textbox', { name: 'New name' }).fill('client');
    await page.getByRole('button', { name: 'Rename', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('#client');
    await page.locator('[data-item-id] a').first().click();
    await expect(page.getByRole('textbox', { name: 'Note', exact: true })).toContainText('#client');
  });
});

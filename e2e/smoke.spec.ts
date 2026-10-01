import { expect, test } from '@playwright/test';

test('opens on Today with no console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/');
  await expect(page).toHaveURL(/#\/today$/);
  await expect(page.getByRole('heading', { name: 'Today', level: 1 })).toBeVisible();
  expect(errors).toEqual([]);
});

test('creates a group, trashes it with undo, and it comes back', async ({ page, isMobile }) => {
  await page.goto('/');
  if (isMobile) {
    await page.getByRole('navigation', { name: 'Quick navigation' }).getByRole('button', { name: 'New' }).click();
    await page.getByRole('menuitem', { name: 'Group' }).click();
  } else await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'New group' }).click();
  await page.getByRole('textbox', { name: 'Name' }).fill('Launch plan');
  await page.getByRole('radio', { name: 'Coral' }).click({ force: true });
  await page.getByRole('button', { name: 'Create group' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Launch plan');

  await page.getByRole('button', { name: 'Group actions' }).click();
  await page.getByRole('menuitem', { name: 'Move to Trash' }).click();
  await expect(page.getByRole('status')).toContainText('Group moved to Trash');
  await page.getByRole('button', { name: 'Undo' }).click();

  await page.goto('/#/trash');
  await expect(page.getByText('Trash is empty')).toBeVisible();
});

test('command palette opens with Ctrl+K and switches theme', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard shortcut');
  await page.goto('/');
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.keyboard.press('Control+k');
  await page.getByPlaceholder('Search notes, or type a command…').fill('light');
  await page.keyboard.press('Enter');
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator('html')).not.toHaveClass(/dark/);
});

test('the old preview address /next/ sends you to the app, keeping the screen', async ({ page }) => {
  await page.goto('/next/#/tasks');
  await expect(page).toHaveURL(/\/#\/tasks$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Tasks' })).toBeVisible();
});

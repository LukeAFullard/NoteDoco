import { expect, test } from '@playwright/test';

test.describe('search', () => {
  test.skip(({ isMobile }) => isMobile, 'keyboard-driven flow');

  test('finds notes and stickies with typos and filters; the palette opens them', async ({ page }) => {
    await page.goto('/#/inbox');
    await page.keyboard.press('n');
    await expect(page.getByRole('textbox', { name: 'Note', exact: true })).toBeFocused();
    await page.keyboard.type('Launch plan');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Ship the beta on Friday #work');
    await expect(page.getByText('Saved', { exact: false })).toBeVisible();
    await page.goto('/#/inbox');
    await page.keyboard.press('s');
    await page.getByRole('textbox', { name: 'Sticky text' }).fill('Buy milk #home');
    await page.getByRole('button', { name: 'Done' }).click();

    await page.goto('/#/search?q=lanch');
    const results = page.getByRole('list', { name: 'Results' });
    await expect(results).toContainText('Launch plan');
    await expect(results.locator('mark').first()).toBeVisible();

    await page.getByRole('searchbox', { name: 'Search notes and stickies' }).fill('kind:sticky');
    await expect(results).toContainText('Buy milk');
    await expect(results).not.toContainText('Launch plan');

    // Archived items are still found, marked as archived; is:archived shows only those.
    await page.goto('/#/inbox');
    const row = page.locator('[data-item-id]', { hasText: 'Buy milk' });
    await row.hover();
    await row.getByRole('button', { name: 'Item actions' }).click();
    await page.getByRole('menuitem', { name: 'Archive' }).click();
    await expect(row).toHaveCount(0);
    await page.goto('/#/search?q=milk');
    await expect(results.getByRole('link', { name: /Buy milk/ })).toContainText('Archived');
    await page.getByRole('searchbox', { name: 'Search notes and stickies' }).fill('is:archived');
    await expect(results).toContainText('Buy milk');
    await expect(results).not.toContainText('Launch plan');

    await page.keyboard.press('Control+k');
    await page.getByPlaceholder('Search notes, or type a command…').fill('friday');
    await expect(page.getByRole('option', { name: /Launch plan/ })).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('textbox', { name: 'Note', exact: true }).locator('p').first()).toContainText('Launch plan');
  });
});

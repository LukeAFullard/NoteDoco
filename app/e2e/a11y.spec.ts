import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/** Serious and critical accessibility problems fail the build (plan §14). */
const PAGES = ['/#/today', '/#/tasks', '/#/timeline', '/#/calendar', '/#/calendar?view=week', '/#/columns', '/#/inbox', '/#/stickies', '/#/search?q=plan', '/#/tags', '/#/trash', '/#/settings', '/#/lab/ink'];

for (const theme of ['dark', 'light'] as const) {
  test.describe(`accessibility (${theme})`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((t) => localStorage.setItem('notedoco:theme', t), theme);
      await page.addInitScript(() => localStorage.setItem('notedoco:installGuideDismissed', 'true'));
    });

    test('main screens have no serious or critical issues', async ({ page }) => {
      test.setTimeout(120_000); // one axe scan per screen
      // Some content, so lists and cards are checked too.
      await page.goto('/#/inbox');
      await page.keyboard.press('s');
      await page.getByRole('textbox', { name: 'Sticky text' }).fill('Plan the week\n- [ ] groceries');
      await page.getByRole('button', { name: 'Done' }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      // Dated things, so Today and Tasks have rows (to-dos, a due date, a repeat, a checklist line).
      await page.goto('/#/today');
      const bar = page.getByRole('textbox', { name: 'Quick add' });
      for (const t of ['buy milk', 'pay rent by tomorrow', 'water plants every day', 'call Sam next tue 3pm']) {
        await bar.fill(t);
        await bar.press('Enter');
      }
      await page.goto('/#/new/note');
      await expect(page.getByRole('textbox', { name: 'Note', exact: true })).toBeFocused();
      await page.keyboard.type('Launch');
      await page.keyboard.press('Enter');
      await page.keyboard.type('[ ] send invites @today ');
      await expect(page.getByText('Saved', { exact: false })).toBeVisible();

      for (const url of PAGES) {
        await page.goto(url);
        await page.waitForTimeout(300);
        const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
        const bad = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
        expect(bad.map((v) => `${url} ${v.id}: ${v.help} (${v.nodes.length}) ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
      }
    });
  });
}

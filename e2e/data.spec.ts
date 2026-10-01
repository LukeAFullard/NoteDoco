import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

test.describe('data safety', () => {
  test.skip(({ isMobile }) => isMobile, 'desktop flow');

  test('backs up, and restores into an empty app', async ({ page, browser }) => {
    await page.goto('/#/inbox');
    await page.keyboard.press('s');
    await page.getByRole('textbox', { name: 'Sticky text' }).fill('Survives a restore');
    await page.getByRole('button', { name: 'Done' }).click();

    await page.goto('/#/settings');
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Back up now' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^notedoco-backup-\d{4}-\d{2}-\d{2}\.zip$/);
    const zipPath = await download.path();

    // A brand-new browser profile: nothing there until the backup is restored.
    const fresh = await (await browser.newContext()).newPage();
    await fresh.goto('/#/settings');
    await fresh.locator('input[type=file][accept*="zip"]').setInputFiles(zipPath);
    await fresh.getByRole('button', { name: 'Merge', exact: true }).click();
    await expect(fresh.getByRole('status').last()).toContainText('Merged');
    await fresh.goto('/#/inbox');
    await expect(fresh.locator('[data-item-id]')).toContainText('Survives a restore');
  });

  test('imports Markdown files and exports a note as Markdown', async ({ page }) => {
    await page.goto('/#/settings');
    await page.locator('input[type=file][multiple]').setInputFiles({
      name: 'Recipe.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from('---\ntags: [food]\n---\n# Pancakes\n- [ ] flour\n- [ ] eggs'),
    });
    await expect(page.getByRole('status').last()).toContainText('Imported 1 note');
    await page.goto('/#/inbox');
    const row = page.locator('[data-item-id]').first();
    await expect(row).toContainText('Pancakes');
    await expect(row).toContainText('#food');

    await row.hover();
    await row.getByRole('button', { name: 'Item actions' }).click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('menuitem', { name: 'Export as Markdown' }).click();
    const md = readFileSync(await (await downloadPromise).path(), 'utf8');
    expect(md).toContain('tags: ["food"]');
    expect(md).toContain('# Pancakes');
  });

  test('brings over notes from NoteDoco v1 on startup', async ({ page }) => {
    await page.goto('/#/today');
    // Create a v1 database the way v1 does, then reload so v2's startup migration runs.
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          const req = indexedDB.open('note-doco-db', 4);
          req.onupgradeneeded = () => {
            const d = req.result;
            d.createObjectStore('projects', { keyPath: 'id' });
            d.createObjectStore('notes', { keyPath: 'id' });
            d.createObjectStore('noteVersions', { keyPath: 'id' });
            d.createObjectStore('settings', { keyPath: 'id' });
            d.createObjectStore('attachments', { keyPath: 'id' });
          };
          req.onsuccess = () => {
            const d = req.result;
            const tx = d.transaction(['projects', 'notes'], 'readwrite');
            const t = '2026-05-01T09:00:00.000Z';
            tx.objectStore('projects').put({ id: 'p1', name: 'From v1', color: 'signal', parentId: null, archived: false, createdAt: t, updatedAt: t });
            tx.objectStore('notes').put({ id: 'n1', projectId: 'p1', title: 'Old note', contentMarkdown: 'Written in v1', goalDate: null, archived: false, createdAt: t, updatedAt: t });
            tx.oncomplete = () => {
              d.close();
              resolve();
            };
          };
        }),
    );
    await page.reload();
    await expect(page.getByRole('status').last()).toContainText('Your 1 note and 1 group came over from the previous version');
    await page.getByRole('list', { name: 'Groups' }).getByRole('link', { name: 'From v1' }).click();
    await expect(page.locator('[data-item-id]')).toContainText('Old note');
  });
});

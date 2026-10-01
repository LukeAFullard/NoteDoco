import { expect, test, type Page } from '@playwright/test';
import { inkedPixels, penStroke, touchDrag, wave } from './support/pen';

async function openNewInkNote(page: Page) {
  await page.addInitScript(() => localStorage.setItem('notedoco:installGuideDismissed', 'true'));
  await page.goto('/#/new/ink');
  const canvas = page.getByTestId('ink-canvas');
  await expect(canvas).toBeVisible();
  await expect(page.getByText(/Page 1 of 1/)).toBeVisible();
  return canvas;
}

test.describe('ink notes', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'pen input via CDP');

  test('writes with a pen, saves as you go, and undoes and redoes', async ({ page, isMobile }) => {
    test.skip(isMobile, 'pen');
    const canvas = await openNewInkNote(page);
    await page.getByRole('textbox', { name: 'Title' }).fill('Lecture notes');
    const box = (await canvas.boundingBox())!;
    const cdp = await page.context().newCDPSession(page);

    await penStroke(cdp, wave(box.x + 80, box.y + 120));
    await expect.poll(() => inkedPixels(page)).toBeGreaterThan(150);

    // Saved straight away: it survives a reload, and so does the title.
    await page.waitForTimeout(600);
    await page.reload();
    await expect(page.getByTestId('ink-canvas')).toBeVisible();
    await expect.poll(() => inkedPixels(page)).toBeGreaterThan(150);
    await expect(page.getByRole('textbox', { name: 'Title' })).toHaveValue('Lecture notes');

    // Undo with the keyboard (the canvas has focus after writing), redo with the button.
    await penStroke(cdp, wave(box.x + 80, box.y + 220));
    const two = await inkedPixels(page);
    await expect(page.getByTestId('ink-canvas')).toBeFocused();
    await page.keyboard.press('Control+z');
    await expect.poll(() => inkedPixels(page)).toBeLessThan(two);
    await page.getByRole('button', { name: 'Redo' }).click();
    await expect.poll(() => inkedPixels(page)).toBe(two);

    // The note is listed in the Inbox under its title.
    await page.goto('/#/inbox');
    await expect(page.locator('[data-item-id]').filter({ hasText: 'Lecture notes' })).toBeVisible();
  });

  test('erases with the eraser tool, the highlighter sits under ink, pages can be added', async ({ page, isMobile }) => {
    test.skip(isMobile, 'pen');
    const canvas = await openNewInkNote(page);
    const box = (await canvas.boundingBox())!;
    const cdp = await page.context().newCDPSession(page);
    await penStroke(cdp, Array.from({ length: 20 }, (_, i) => [box.x + 100 + i * 10, box.y + 200] as [number, number]));
    await expect.poll(() => inkedPixels(page)).toBeGreaterThan(100);

    // Tool shortcuts work while the canvas has focus.
    await page.keyboard.press('h');
    await expect(page.getByRole('radio', { name: /Highlighter/ })).toBeChecked();
    await penStroke(cdp, Array.from({ length: 20 }, (_, i) => [box.x + 100 + i * 10, box.y + 200] as [number, number]));
    // The pen stroke's pixels are still the pen colour where the highlighter crosses it.
    const centre = await page.evaluate(([x, y]) => {
      const c = document.querySelector('canvas[data-layer="dry"]') as HTMLCanvasElement;
      const r = c.getBoundingClientRect();
      const s = c.width / r.width;
      return [...c.getContext('2d')!.getImageData(Math.round((x! - r.left) * s), Math.round((y! - r.top) * s), 1, 1).data];
    }, [box.x + 190, box.y + 200]);
    expect(centre[0]).toBeLessThan(80); // black ink, not yellow

    await page.locator('label', { has: page.getByRole('radio', { name: /Eraser/ }) }).click();
    await penStroke(cdp, Array.from({ length: 16 }, (_, i) => [box.x + 190, box.y + 140 + i * 8] as [number, number]));
    await expect.poll(() => inkedPixels(page)).toBe(0);

    await page.getByRole('button', { name: 'Pages and more' }).click();
    await page.getByRole('menuitem', { name: 'Add a page' }).click();
    await expect(page.getByText(/Page 2 of 2/)).toBeVisible();
  });

  test('lasso selects ink to move, recolour and delete; undo brings it back', async ({ page, isMobile }) => {
    test.skip(isMobile, 'pen');
    const canvas = await openNewInkNote(page);
    const box = (await canvas.boundingBox())!;
    const cdp = await page.context().newCDPSession(page);
    await penStroke(cdp, wave(box.x + 120, box.y + 150, 20));
    const inked = await inkedPixels(page);
    expect(inked).toBeGreaterThan(80);

    await page.keyboard.press('l');
    // Loop around the stroke.
    const loop: Array<[number, number]> = [];
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      loop.push([box.x + 177 + Math.cos(a) * 110, box.y + 150 + Math.sin(a) * 60]);
    }
    await penStroke(cdp, loop);
    const bar = page.getByRole('toolbar', { name: 'Selected ink' });
    await expect(bar).toContainText('1 selected');

    // Drag it down by 150 px: the ink leaves its old place.
    await penStroke(cdp, Array.from({ length: 10 }, (_, i) => [box.x + 177, box.y + 150 + i * 15] as [number, number]));
    const at = (y: number) =>
      page.evaluate(
        ([x0, x1, yy]) => {
          const c = document.querySelector('canvas[data-layer="dry"]') as HTMLCanvasElement;
          const r = c.getBoundingClientRect();
          const s = c.width / r.width;
          const d = c.getContext('2d')!.getImageData(Math.round((x0! - r.left) * s), Math.round((yy! - 30 - r.top) * s), Math.round((x1! - x0!) * s), Math.round(60 * s)).data;
          let n = 0;
          for (let i = 3; i < d.length; i += 4) if (d[i]! > 0) n++;
          return n;
        },
        [box.x + 100, box.x + 260, y],
      );
    await expect.poll(() => at(box.y + 150)).toBe(0);
    expect(await at(box.y + 285)).toBeGreaterThan(50);

    await page.keyboard.press('Delete');
    await expect.poll(() => inkedPixels(page)).toBe(0);
    await expect(bar).toHaveCount(0);
    await page.keyboard.press('Control+z');
    await expect.poll(() => inkedPixels(page)).toBeGreaterThan(50);
    await page.keyboard.press('Control+z');
    await expect.poll(() => at(box.y + 150)).toBeGreaterThan(50);
  });

  test('the precise eraser cuts a stroke in two; favourites switch pens', async ({ page, isMobile }) => {
    test.skip(isMobile, 'pen');
    const canvas = await openNewInkNote(page);
    const box = (await canvas.boundingBox())!;
    const cdp = await page.context().newCDPSession(page);

    // Blue ballpoint from the favourites bar.
    await page.getByRole('button', { name: 'Blue ballpoint, medium' }).click();
    await expect(page.getByRole('button', { name: 'Blue ballpoint, medium' })).toHaveAttribute('aria-pressed', 'true');
    await penStroke(cdp, Array.from({ length: 30 }, (_, i) => [box.x + 100 + i * 8, box.y + 200] as [number, number]));
    const full = await inkedPixels(page);

    await page.keyboard.press('e');
    await page.getByRole('button', { name: 'Eraser options' }).click();
    await page.getByRole('radio', { name: 'Only what it touches' }).check({ force: true });
    await page.keyboard.press('Escape');
    await penStroke(cdp, Array.from({ length: 12 }, (_, i) => [box.x + 200, box.y + 150 + i * 9] as [number, number]));
    // Part of the line is gone, not all of it.
    await expect.poll(() => inkedPixels(page)).toBeLessThan(full);
    expect(await inkedPixels(page)).toBeGreaterThan(full / 2);
    await page.keyboard.press('Control+z');
    await expect.poll(() => inkedPixels(page)).toBe(full);
  });

  test('pages: sorter deletes with undo; paper changes to lined', async ({ page, isMobile }) => {
    test.skip(isMobile, 'pen');
    const canvas = await openNewInkNote(page);
    const more = async (name: string) => {
      await page.getByRole('button', { name: 'Pages and more' }).click();
      await page.getByRole('menuitem', { name }).click();
    };
    await more('Add a page');
    await expect(page.getByText(/of 2/)).toBeVisible();
    await more('Pages…');
    const dialog = page.getByRole('dialog', { name: 'Pages' });
    await expect(dialog.getByRole('img')).toHaveCount(0); // thumbnails are decorative
    await dialog.getByRole('button', { name: 'Delete page 2' }).click();
    await expect(dialog.getByRole('button', { name: /Go to page/ })).toHaveCount(1);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Undo' }).last().click(); // the toast's Undo
    await expect(page.getByText(/of 2/)).toBeVisible();

    const blank = await inkedPixels(page, 'paper');
    await more('Paper…');
    const paper = page.getByRole('dialog', { name: 'Paper' });
    await paper.getByRole('radio', { name: 'Lined' }).check({ force: true });
    await paper.getByRole('button', { name: 'Apply' }).click();
    // Lined paper draws rules: the paper layer changes.
    await expect.poll(async () => {
      const lined = await page.evaluate(() => {
        const c = document.querySelector('canvas[data-layer="paper"]') as HTMLCanvasElement;
        const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
        const seen = new Set<number>();
        for (let i = 0; i < d.length; i += 4) seen.add((d[i]! << 16) | (d[i + 1]! << 8) | d[i + 2]!);
        return seen.size;
      });
      return lined;
    }).toBeGreaterThan(3);
    expect(blank).toBeGreaterThan(0);
    await expect(canvas).toBeVisible();
  });

  test('a finger draws on a phone; two fingers scroll the page', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'touch');
    const canvas = await openNewInkNote(page);
    const box = (await canvas.boundingBox())!;
    const cdp = await page.context().newCDPSession(page);
    await touchDrag(cdp, [Array.from({ length: 20 }, (_, i) => [box.x + 40 + i * 8, box.y + 80 + (i % 5) * 4] as [number, number])]);
    await expect.poll(() => inkedPixels(page)).toBeGreaterThan(50);
    const before = await inkedPixels(page);

    // Two fingers dragging up scroll the page instead of drawing.
    await touchDrag(cdp, [
      Array.from({ length: 10 }, (_, i) => [box.x + 100, box.y + 300 - i * 20] as [number, number]),
      Array.from({ length: 10 }, (_, i) => [box.x + 200, box.y + 300 - i * 20] as [number, number]),
    ]);
    await expect.poll(() => inkedPixels(page)).not.toBe(before);
    const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
    expect(scroll).toBeLessThanOrEqual(client);
  });
});

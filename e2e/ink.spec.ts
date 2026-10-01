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

    await page.getByRole('button', { name: 'Add a page' }).click();
    await expect(page.getByText(/Page 2 of 2/)).toBeVisible();
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

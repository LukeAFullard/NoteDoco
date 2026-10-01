import { expect, test, type Page, type CDPSession } from '@playwright/test';

/** Sends real pen input through the DevTools protocol (Chromium only), with pressure and tilt. */
async function penStroke(cdp: CDPSession, points: Array<[number, number]>, pressure = 0.6) {
  const send = (type: string, x: number, y: number, force: number, buttons = 1) =>
    cdp.send('Input.dispatchMouseEvent', {
      type,
      x,
      y,
      button: 'left',
      buttons,
      clickCount: 1,
      pointerType: 'pen',
      force,
      tiltX: 20,
      tiltY: 10,
    } as never);
  const [first, ...rest] = points;
  await send('mousePressed', first![0], first![1], pressure);
  for (const [x, y] of rest) await send('mouseMoved', x, y, pressure);
  const last = points.at(-1)!;
  await send('mouseReleased', last[0], last[1], 0, 0);
}

async function inkedPixels(page: Page): Promise<number> {
  return page.evaluate(() => {
    const c = document.querySelector('canvas[data-layer="dry"]') as HTMLCanvasElement;
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i]! > 0) n++;
    return n;
  });
}

test.describe('ink lab', () => {
  test.skip(({ browserName, isMobile }) => browserName !== 'chromium' || isMobile, 'pen input via CDP');

  test('draws pressure-sensitive pen strokes, undoes and redoes them', async ({ page }) => {
    await page.goto('/#/lab/ink');
    const surface = page.getByTestId('ink-surface');
    await expect(surface).toBeVisible();
    const box = (await surface.boundingBox())!;
    const cdp = await page.context().newCDPSession(page);

    const wave = Array.from({ length: 40 }, (_, i) => [box.x + 100 + i * 8, box.y + 150 + Math.sin(i / 3) * 30] as [number, number]);
    await penStroke(cdp, wave);
    await expect.poll(() => inkedPixels(page)).toBeGreaterThan(200);
    await expect(page.getByRole('button', { name: 'Clear' })).toBeEnabled();

    await page.getByRole('button', { name: 'Undo' }).click();
    await expect.poll(() => inkedPixels(page)).toBe(0);
    await page.getByRole('button', { name: 'Redo' }).click();
    await expect.poll(() => inkedPixels(page)).toBeGreaterThan(200);

    // Measurements picked up the pen and its pressure.
    await expect(page.getByText('pen:1')).toBeVisible();
  });

  test('erases strokes the eraser passes over', async ({ page }) => {
    await page.goto('/#/lab/ink');
    const box = (await page.getByTestId('ink-surface').boundingBox())!;
    const cdp = await page.context().newCDPSession(page);
    await penStroke(cdp, Array.from({ length: 20 }, (_, i) => [box.x + 100 + i * 10, box.y + 200] as [number, number]));
    await expect.poll(() => inkedPixels(page)).toBeGreaterThan(100);
    await page.getByRole('button', { name: 'Eraser' }).click();
    await penStroke(cdp, Array.from({ length: 12 }, (_, i) => [box.x + 190, box.y + 150 + i * 10] as [number, number]));
    await expect.poll(() => inkedPixels(page)).toBe(0);
  });

  test('copies a measurement report', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/#/lab/ink');
    const box = (await page.getByTestId('ink-surface').boundingBox())!;
    const cdp = await page.context().newCDPSession(page);
    await penStroke(cdp, Array.from({ length: 60 }, (_, i) => [box.x + 80 + i * 5, box.y + 120 + (i % 7) * 4] as [number, number]));
    await page.getByRole('button', { name: 'Copy report' }).click();
    const report = JSON.parse(await page.evaluate(() => navigator.clipboard.readText()));
    expect(report.kind).toBe('notedoco-ink-lab-report');
    expect(report.measured.strokes).toBe(1);
    expect(report.measured.pointerTypes.pen).toBe(1);
    expect(report.support.coalescedEvents).toBe(true);
  });
});

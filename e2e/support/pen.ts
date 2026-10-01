import type { CDPSession, Page } from '@playwright/test';

/** Sends real pen input through the DevTools protocol (Chromium only), with pressure and tilt. */
export async function penStroke(cdp: CDPSession, points: Array<[number, number]>, pressure = 0.6, holdMs = 0) {
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
  if (holdMs) {
    await new Promise((r) => setTimeout(r, holdMs));
    await send('mouseMoved', last[0], last[1], pressure);
  }
  await send('mouseReleased', last[0], last[1], 0, 0);
}

/** A finger drag (or several fingers at once) through the DevTools protocol. */
export async function touchDrag(cdp: CDPSession, fingers: Array<Array<[number, number]>>, radius = 4) {
  const at = (i: number) => fingers.map((f, id) => ({ x: f[Math.min(i, f.length - 1)]![0], y: f[Math.min(i, f.length - 1)]![1], id, radiusX: radius, radiusY: radius }));
  const steps = Math.max(...fingers.map((f) => f.length));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: at(0) });
  for (let i = 1; i < steps; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: at(i) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

/** Painted pixels on a canvas layer ("dry" = committed ink). */
export async function inkedPixels(page: Page, layer = 'dry'): Promise<number> {
  return page.evaluate((l) => {
    const c = document.querySelector(`canvas[data-layer="${l}"]`) as HTMLCanvasElement | null;
    if (!c) return -1;
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i]! > 0) n++;
    return n;
  }, layer);
}

export const wave = (x: number, y: number, n = 40): Array<[number, number]> => Array.from({ length: n }, (_, i) => [x + i * 6, y + Math.sin(i / 3) * 20]);

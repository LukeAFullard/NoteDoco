import { clampCamera, fitWidth, Inertia, toScreen, toWorld, visibleWorld, zoomAt } from './camera';

describe('camera', () => {
  it('maps between screen and world', () => {
    const cam = { x: 100, y: 50, zoom: 2 };
    expect(toWorld(cam, 300, 250)).toEqual({ x: 100, y: 100 });
    expect(toScreen(cam, 100, 100)).toEqual({ x: 300, y: 250 });
    expect(visibleWorld(cam, { w: 400, h: 200 })).toEqual({ minX: -50, minY: -25, maxX: 150, maxY: 75 });
  });

  it('zooms around a point and respects the limits', () => {
    const cam = { x: 0, y: 0, zoom: 1 };
    const z = zoomAt(cam, 200, 100, 2);
    expect(toWorld(z, 200, 100)).toEqual(toWorld(cam, 200, 100));
    expect(z.zoom).toBe(2);
    expect(zoomAt(cam, 0, 0, 1000).zoom).toBe(8);
    expect(zoomAt(cam, 0, 0, 0.0001).zoom).toBe(0.2);
  });

  it('fits content width, centred and top-aligned', () => {
    const cam = fitWidth({ minX: -397, minY: 0, maxX: 397, maxY: 1123 }, { w: 360, h: 640 }, { pad: 16, maxZoom: 1 });
    expect(cam.zoom).toBeCloseTo(328 / 794);
    expect(toScreen(cam, -397, 0)).toEqual({ x: expect.closeTo(16) as number, y: 16 });
    // A wide screen doesn't blow the page up past maxZoom.
    expect(fitWidth({ minX: -397, minY: 0, maxX: 397, maxY: 1123 }, { w: 3000, h: 900 }, { maxZoom: 1 }).zoom).toBe(1);
  });

  it('keeps content reachable', () => {
    const content = { minX: -400, minY: 0, maxX: 400, maxY: 3000 };
    const view = { w: 1000, h: 800 };
    // Narrower than the view: centred horizontally whatever you do.
    expect(clampCamera({ x: -5000, y: 0, zoom: 1 }, view, content).x).toBe(500);
    // Taller than the view: can't scroll past either end by more than the margin.
    expect(clampCamera({ x: 500, y: 5000, zoom: 1 }, view, content, 48).y).toBe(48);
    expect(clampCamera({ x: 500, y: -9000, zoom: 1 }, view, content, 48).y).toBe(800 - 48 - 3000);
  });
});

describe('inertia', () => {
  it('coasts after a fast fling and comes to rest', () => {
    const i = new Inertia();
    for (let t = 0; t <= 50; t += 10) i.track(0, t * 2, t); // 2 px/ms downwards
    expect(i.release(55)).toBe(true);
    let travelled = 0;
    let steps = 0;
    for (let s = i.step(16); s; s = i.step(16)) {
      travelled += s.dy;
      if (++steps > 1000) break;
    }
    expect(steps).toBeLessThan(1000);
    // Total ≈ v·τ = 2 × 325.
    expect(travelled).toBeGreaterThan(550);
    expect(travelled).toBeLessThan(660);
  });

  it('does not coast after a slow drag or a pause before release', () => {
    const slow = new Inertia();
    for (let t = 0; t <= 100; t += 10) slow.track(0, t * 0.01, t);
    expect(slow.release(100)).toBe(false);
    const paused = new Inertia();
    for (let t = 0; t <= 50; t += 10) paused.track(0, t * 2, t);
    expect(paused.release(400)).toBe(false);
  });
});

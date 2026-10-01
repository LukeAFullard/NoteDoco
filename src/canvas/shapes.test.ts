import { recognise, shapeToInk, simplify } from './shapes';

/** A deterministic wobble, like a hand. */
const wobble = (i: number, amount: number) => Math.sin(i * 1.7) * amount + Math.cos(i * 0.6) * amount * 0.5;

function polyline(vertices: Array<[number, number]>, perSide = 20, amount = 2) {
  const out: Array<{ x: number; y: number }> = [];
  let k = 0;
  for (let v = 0; v < vertices.length - 1; v++) {
    const [ax, ay] = vertices[v]!;
    const [bx, by] = vertices[v + 1]!;
    for (let i = 0; i < perSide; i++, k++) {
      const t = i / perSide;
      out.push({ x: ax + (bx - ax) * t + wobble(k, amount), y: ay + (by - ay) * t + wobble(k + 3, amount) });
    }
  }
  const [lx, ly] = vertices.at(-1)!;
  out.push({ x: lx, y: ly });
  return out;
}

describe('shape snapping', () => {
  it('straightens a wobbly line', () => {
    const s = recognise(polyline([[0, 0], [200, 30]]));
    expect(s?.kind).toBe('line');
    expect(s!.points).toHaveLength(2);
  });

  it('leaves a scribble alone', () => {
    const scribble = Array.from({ length: 60 }, (_, i) => ({ x: i * 4, y: Math.sin(i / 2) * 40 }));
    expect(recognise(scribble)).toBeNull();
    expect(recognise([{ x: 0, y: 0 }, { x: 2, y: 2 }, { x: 3, y: 1 }, { x: 4, y: 4 }])).toBeNull(); // too small
  });

  it('recognises a rectangle and squares it up', () => {
    const s = recognise(polyline([[0, 0], [240, 4], [236, 150], [-3, 146], [2, 2]]));
    expect(s?.kind).toBe('rectangle');
    const xs = s!.points.map((p) => Math.round(p.x));
    const ys = s!.points.map((p) => Math.round(p.y));
    // Axis-aligned: only two distinct x and two distinct y values.
    expect(new Set(xs).size).toBe(2);
    expect(new Set(ys).size).toBe(2);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(220);
  });

  it('recognises a triangle', () => {
    const s = recognise(polyline([[0, 150], [100, 0], [200, 150], [2, 148]]));
    expect(s?.kind).toBe('triangle');
    expect(s!.points).toHaveLength(4);
  });

  it('recognises circles and ellipses', () => {
    const loop = (rx: number, ry: number) =>
      Array.from({ length: 81 }, (_, i) => {
        const t = (i / 80) * Math.PI * 2;
        return { x: 300 + rx * Math.cos(t) + wobble(i, 2), y: 200 + ry * Math.sin(t) + wobble(i + 5, 2) };
      });
    const circle = recognise(loop(100, 96));
    expect(circle?.kind).toBe('ellipse');
    const r = circle!.points.map((p) => Math.hypot(p.x - 300, p.y - 200));
    expect(Math.max(...r) - Math.min(...r)).toBeLessThan(6); // made perfectly round
    expect(recognise(loop(160, 70))?.kind).toBe('ellipse');
  });

  it('recognises an arrow drawn in one go', () => {
    const s = recognise(polyline([[0, 100], [200, 100], [180, 85], [200, 100], [180, 115]], 15, 1));
    expect(s?.kind).toBe('arrow');
    expect(s!.points[1]).toMatchObject({ x: expect.closeTo(200, 0) as number });
  });

  it('turns shapes into evenly spaced ink with constant pressure', () => {
    const ink = shapeToInk({ kind: 'line', points: [{ x: 0, y: 0 }, { x: 30, y: 0 }] }, 3);
    expect(ink).toHaveLength(11);
    expect(new Set(ink.map((p) => p.p))).toEqual(new Set([0.5]));
    expect(simplify(ink, 1)).toHaveLength(2);
  });
});

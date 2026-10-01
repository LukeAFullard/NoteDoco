import { boundsOfStrokes, fromStored, InkModel, makeStroke, splitStroke, toStored, transformStroke, type InkStroke } from './model';
import { rotateAbout, scaleAbout, translate } from './geometry';
import { newId } from '@/lib/ids';

const line = (pageId: string, y: number, x0 = 0, x1 = 100): InkStroke =>
  makeStroke({
    id: newId(),
    pageId,
    tool: 'ballpoint',
    colour: 'black',
    size: 1,
    pressure: true,
    points: Array.from({ length: 11 }, (_, i) => ({ x: x0 + ((x1 - x0) * i) / 10, y, p: 0.5, t: i * 8 })),
    createdAt: new Date().toISOString(),
  });

describe('ink model', () => {
  it('indexes strokes per page and finds them by area and by touch', () => {
    const a = line('p1', 10);
    const b = line('p1', 200);
    const c = line('p2', 10);
    const m = new InkModel([a, b, c]);
    expect(m.count).toBe(3);
    expect(m.query('p1', { minX: 0, minY: 0, maxX: 50, maxY: 50 })).toEqual([a]);
    expect(m.hit('p1', 50, 12, 4)).toEqual([a]);
    expect(m.hit('p1', 50, 100, 4)).toEqual([]);
    expect(m.hit('p2', 50, 10, 4)).toEqual([c]);
    expect(m.contentBottom('p1')).toBeGreaterThan(200);
    expect(m.contentBottom('nope')).toBe(0);
  });

  it('undoes and redoes actions, and a new action clears redo', () => {
    const m = new InkModel();
    const a = line('p', 10);
    const b = line('p', 50);
    m.commit({ added: [a], removed: [] });
    m.commit({ added: [b], removed: [] });
    expect(m.undo()).toEqual({ added: [], removed: [b] });
    expect(m.strokes('p')).toEqual([a]);
    expect(m.redo()).toEqual({ added: [b], removed: [] });
    expect(m.strokes('p')).toEqual([a, b]);
    m.undo();
    m.commit({ added: [line('p', 90)], removed: [] });
    expect(m.canRedo).toBe(false);
    expect(m.commit({ added: [], removed: [] })).toBeNull();
  });

  it('puts an erased stroke back in its original place in the stack', () => {
    const [a, b, c] = [line('p', 10), line('p', 20), line('p', 30)];
    const m = new InkModel([a, b, c]);
    m.apply({ added: [], removed: [b] }); // erased live while dragging
    m.record({ added: [], removed: [b] });
    expect(m.strokes('p')).toEqual([a, c]);
    m.undo();
    expect(m.strokes('p')).toEqual([a, b, c]);
  });

  it('drops a deleted page', () => {
    const m = new InkModel([line('p', 10), line('q', 10)]);
    expect(m.dropPage('p')).toHaveLength(1);
    expect(m.count).toBe(1);
  });

  it('round-trips through storage', () => {
    const s = line('p', 33.5);
    const back = fromStored(toStored(s));
    expect(back).toMatchObject({ id: s.id, pageId: 'p', tool: 'ballpoint', colour: 'black', size: 1, pressure: true });
    expect(back.points).toHaveLength(11);
    expect(back.points[3]!.x).toBeCloseTo(30, 1);
    expect(back.points[3]!.y).toBeCloseTo(33.5, 1);
    expect(toStored(s).opacity).toBe(1);
    expect(fromStored({ ...toStored(s), pressure: undefined }).pressure).toBe(true);
  });
});

describe('ink tools on the model', () => {
  it('precise erase cuts a gap and the pieces keep the stroke’s place', () => {
    const [a, b, c] = [line('p', 10), line('p', 10), line('p', 50)];
    const m = new InkModel([a, b, c]);
    const pieces = splitStroke(b, 50, 10, 4)!;
    expect(pieces).toHaveLength(2);
    expect(pieces[0]!.points.at(-1)!.x).toBeLessThan(50 - 4);
    expect(pieces[1]!.points[0]!.x).toBeGreaterThan(50 + 4);
    expect(pieces[1]!.points[0]!.t).toBe(0);
    m.commit({ added: pieces, removed: [b] });
    expect(m.strokes('p').map((s) => s.id)).toEqual([a.id, ...pieces.map((s) => s.id), c.id]);
    expect(splitStroke(b, 50, 300, 4)).toBeNull();
    // Erasing the whole thing leaves nothing.
    expect(splitStroke(line('p', 0, 0, 4), 2, 0, 10)).toEqual([]);
  });

  it('lasso picks strokes mostly inside the loop', () => {
    const a = line('p', 10);
    const b = line('p', 100);
    const m = new InkModel([a, b]);
    const loop = [
      { x: -10, y: -10 },
      { x: 35, y: -10 },
      { x: 35, y: 40 },
      { x: -10, y: 40 },
    ];
    expect(m.inPolygon('p', loop)).toEqual([]); // only 4 of its 11 points are inside
    const wide = loop.map((p) => ({ ...p, x: p.x === 35 ? 120 : p.x }));
    expect(m.inPolygon('p', wide)).toEqual([a]);
  });

  it('moves, scales and rotates strokes, scaling their thickness too', () => {
    const s = line('p', 0, 0, 100);
    const moved = transformStroke(s, translate(10, 20));
    expect(moved.id).toBe(s.id);
    expect(moved.points[0]).toMatchObject({ x: 10, y: 20 });
    const big = transformStroke(s, scaleAbout(2, 0, 0));
    expect(big.points.at(-1)!.x).toBe(200);
    expect(big.size).toBe(2);
    const turned = transformStroke(s, rotateAbout(Math.PI / 2, 0, 0));
    expect(turned.points.at(-1)!.x).toBeCloseTo(0);
    expect(turned.points.at(-1)!.y).toBeCloseTo(100);
    expect(boundsOfStrokes([s, moved])!.maxY).toBeGreaterThan(20);
  });

  it('dropping a page also drops it from the history', () => {
    const m = new InkModel();
    m.commit({ added: [line('gone', 1)], removed: [] });
    m.commit({ added: [line('kept', 1)], removed: [] });
    m.dropPage('gone');
    expect(m.undo()!.removed[0]!.pageId).toBe('kept');
    expect(m.canUndo).toBe(false);
  });
});

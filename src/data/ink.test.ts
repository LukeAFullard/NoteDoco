import { db } from './db';
import { createItem, deleteItemsForever, discardIfEmpty, duplicateItem, updateItem } from './repos/items';
import { addPage, loadInk, saveStrokes, setPaper, strokeCount } from './repos/ink';
import { encodePoints } from '@/canvas/points';
import type { Stroke } from './types';
import { newId } from '@/lib/ids';
import { freshDb } from '@/test/db';

beforeEach(freshDb);

const stroke = (pageId: string): Stroke => ({
  id: newId(),
  pageId,
  tool: 'ballpoint',
  colour: 'black',
  size: 1,
  opacity: 1,
  pressure: true,
  points: encodePoints([
    { x: 1, y: 2, p: 0.5, t: 0 },
    { x: 10, y: 20, p: 0.6, t: 8 },
  ]),
  bbox: [0, 0, 11, 21],
  createdAt: new Date().toISOString(),
});

describe('ink notes', () => {
  it('creates a document with one page', async () => {
    const id = await createItem({ kind: 'ink' });
    const item = (await db.items.get(id))!;
    expect(item.kind).toBe('ink');
    expect(item.preview).toBe('Handwritten · 1 page');
    const { doc, pages, strokes } = await loadInk(id);
    expect(doc.itemId).toBe(id);
    expect(pages).toHaveLength(1);
    expect(pages[0]!.paper).toEqual({ size: 'a4', template: 'blank', colour: 'white' });
    expect(strokes).toEqual([]);
  });

  it('saves strokes as they are written and touches the item', async () => {
    const id = await createItem({ kind: 'ink' });
    const { pages } = await loadInk(id);
    const before = (await db.items.get(id))!;
    const a = stroke(pages[0]!.id);
    const b = stroke(pages[0]!.id);
    await saveStrokes(id, [a, b], []);
    await saveStrokes(id, [], [a.id]);
    const { strokes } = await loadInk(id);
    expect(strokes.map((s) => s.id)).toEqual([b.id]);
    expect(Object.prototype.toString.call(strokes[0]!.points)).toBe('[object Uint8Array]');
    expect((await db.items.get(id))!.rev).toBeGreaterThan(before.rev);
  });

  it('adds pages in order and changes paper', async () => {
    const id = await createItem({ kind: 'ink' });
    const first = (await loadInk(id)).pages[0]!;
    const third = await addPage(id);
    const second = await addPage(id, first.id);
    expect((await loadInk(id)).pages.map((p) => p.id)).toEqual([first.id, second.id, third.id]);
    expect((await db.items.get(id))!.preview).toBe('Handwritten · 3 pages');
    await setPaper(id, { size: 'letter', template: 'lined', colour: 'cream' }, [second.id]);
    const { doc, pages } = await loadInk(id);
    expect(pages.map((p) => p.paper.template)).toEqual(['blank', 'lined', 'blank']);
    expect(doc.paper.template).toBe('blank');
    await setPaper(id, { size: 'a4', template: 'grid', colour: 'white' });
    expect((await loadInk(id)).doc.paper.template).toBe('grid');
  });

  it('duplicates the pages and strokes', async () => {
    const id = await createItem({ kind: 'ink' });
    await updateItem(id, { title: 'Sketches' });
    const { pages } = await loadInk(id);
    await saveStrokes(id, [stroke(pages[0]!.id)], []);
    await addPage(id);
    const copy = await duplicateItem(id);
    const c = await loadInk(copy);
    expect((await db.items.get(copy))!.title).toBe('Sketches');
    expect(c.pages).toHaveLength(2);
    expect(c.strokes).toHaveLength(1);
    expect(c.strokes[0]!.pageId).toBe(c.pages[0]!.id);
    expect(await db.inkDocs.count()).toBe(2);
    expect(await db.inkPages.count()).toBe(4);
  });

  it('deletes everything when purged, and discards an untouched note', async () => {
    const id = await createItem({ kind: 'ink' });
    await saveStrokes(id, [stroke((await loadInk(id)).pages[0]!.id)], []);
    expect(await strokeCount(id)).toBe(1);
    expect(await discardIfEmpty(id)).toBe(false);
    await deleteItemsForever([id]);
    expect(await db.inkDocs.count()).toBe(0);
    expect(await db.inkPages.count()).toBe(0);
    expect(await db.strokes.count()).toBe(0);

    const empty = await createItem({ kind: 'ink' });
    expect(await discardIfEmpty(empty)).toBe(true);
    expect(await db.items.get(empty)).toBeUndefined();
    expect(await db.inkDocs.count()).toBe(0);
  });

  it('recreates a missing body when opened', async () => {
    const id = await createItem({ kind: 'ink' });
    await db.inkDocs.clear();
    await db.inkPages.clear();
    const { pages } = await loadInk(id);
    expect(pages).toHaveLength(1);
  });
});

describe('ink pages with undo', () => {
  it('deletes, moves, duplicates and re-papers pages, and undoes each', async () => {
    const { deletePageWithUndo, duplicatePageWithUndo, movePageWithUndo, setPaperWithUndo } = await import('./actions');
    const { undo } = await import('./undo');
    const id = await createItem({ kind: 'ink' });
    const p1 = (await loadInk(id)).pages[0]!;
    const p2 = await addPage(id);
    await saveStrokes(id, [stroke(p2.id), stroke(p2.id)], []);
    const order = async () => (await loadInk(id)).pages.map((p) => p.id);

    expect(await deletePageWithUndo(id, p2.id)).toBe('Page deleted');
    expect(await order()).toEqual([p1.id]);
    expect(await db.strokes.count()).toBe(0);
    expect(await deletePageWithUndo(id, p1.id)).toBeNull(); // the last page stays
    await undo();
    expect(await order()).toEqual([p1.id, p2.id]);
    expect(await db.strokes.count()).toBe(2);

    await movePageWithUndo(id, p2.id, p1.id);
    expect(await order()).toEqual([p2.id, p1.id]);
    await undo();
    expect(await order()).toEqual([p1.id, p2.id]);

    const dup = (await duplicatePageWithUndo(id, p2.id))!;
    expect(await order()).toEqual([p1.id, p2.id, dup.pageId]);
    expect(await db.strokes.where('pageId').equals(dup.pageId).count()).toBe(2);
    await undo();
    expect(await order()).toEqual([p1.id, p2.id]);
    expect(await db.strokes.count()).toBe(2);

    await setPaperWithUndo(id, { size: 'letter', template: 'dot', colour: 'dark' });
    expect((await loadInk(id)).pages.every((p) => p.paper.template === 'dot')).toBe(true);
    await undo();
    expect((await loadInk(id)).pages.every((p) => p.paper.template === 'blank')).toBe(true);
    expect((await loadInk(id)).doc.paper.template).toBe('blank');
  });
});

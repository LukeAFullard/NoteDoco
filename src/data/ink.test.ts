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
    expect((await loadInk(id)).strokes).toHaveLength(0);
    expect(await db.strokes.count()).toBe(2); // kept, like the Trash, until purged
    expect(await deletePageWithUndo(id, p1.id)).toBeNull(); // the last page stays
    await undo();
    expect(await order()).toEqual([p1.id, p2.id]);
    expect((await loadInk(id)).strokes).toHaveLength(2);

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

describe('text boxes and images', () => {
  const element = (pageId: string, attachmentId: string | null = null) => ({
    id: newId(),
    pageId,
    kind: (attachmentId ? 'image' : 'text') as 'image' | 'text',
    x: 10,
    y: 10,
    w: 100,
    h: 40,
    text: attachmentId ? '' : 'Hello',
    fontSize: 18,
    colour: 'black',
    attachmentId,
    createdAt: new Date().toISOString(),
  });

  it('saves elements, copies them (and their pictures) on duplicate, and purges them', async () => {
    const { addAttachment } = await import('./repos/attachments');
    const { deletePageWithUndo } = await import('./actions');
    const { undo } = await import('./undo');
    const id = await createItem({ kind: 'ink' });
    const page = (await loadInk(id)).pages[0]!;
    const att = await addAttachment(id, new Blob(['png'], { type: 'image/png' }), 'a.png');
    const text = element(page.id);
    await saveStrokes(id, [], [], [text, element(page.id, att.id)]);
    expect((await loadInk(id)).elements).toHaveLength(2);
    expect(await discardIfEmpty(id)).toBe(false);

    const copy = await duplicateItem(id);
    const copied = (await loadInk(copy)).elements;
    expect(copied).toHaveLength(2);
    const img = copied.find((e) => e.kind === 'image')!;
    expect(img.attachmentId).not.toBe(att.id);
    expect((await db.attachments.get(img.attachmentId!))!.itemId).toBe(copy);

    // Deleting a page takes its elements; undo brings them back.
    const second = await addPage(id);
    await saveStrokes(id, [], [], [element(second.id)]);
    await deletePageWithUndo(id, second.id);
    expect((await loadInk(id)).elements.filter((e) => e.pageId === second.id)).toHaveLength(0);
    await undo();
    expect((await loadInk(id)).elements.filter((e) => e.pageId === second.id)).toHaveLength(1);

    await saveStrokes(id, [], [], [], [text.id]);
    expect((await loadInk(id)).elements.filter((e) => e.pageId === page.id).map((e) => e.kind)).toEqual(['image']);
    await deleteItemsForever([id, copy]);
    expect(await db.inkElements.count()).toBe(0);
    expect(await db.attachments.count()).toBe(0);
  });
});

describe('sketch blocks in typed notes', () => {
  it('creates, loads, copies on duplicate and purges sketches', async () => {
    const { createSketch, sketchUrl, sketchIdFromUrl } = await import('./repos/ink');
    const { setBodyText } = await import('./repos/items');
    const note = await createItem({ kind: 'note', text: 'Plan' });
    const docId = await createSketch(note);
    await setBodyText(note, `Plan\n\n![sketch](${sketchUrl(docId)})`);
    const sketch = await loadInk(note, docId);
    expect(sketch.doc.layout).toBe('block');
    expect(sketch.pages[0]!.paper.size).toBe('endless');
    await saveStrokes(note, [stroke(sketch.pages[0]!.id)], []);

    const copy = await duplicateItem(note);
    const text = (await db.noteBodies.get(copy))!.text;
    const copyDoc = sketchIdFromUrl(/\((ndoco:ink\/[^)]+)\)/.exec(text)![1]!)!;
    expect(copyDoc).not.toBe(docId);
    const copied = await loadInk(copy, copyDoc);
    expect(copied.doc.itemId).toBe(copy);
    expect(copied.strokes).toHaveLength(1);

    await deleteItemsForever([note, copy]);
    expect(await db.inkDocs.count()).toBe(0);
    expect(await db.strokes.count()).toBe(0);
    await expect(loadInk(note, docId)).rejects.toThrow(/no longer stored/);
  });
});

describe('deleted pages', () => {
  it('are kept for the Trash period with their ink, then purged', async () => {
    const { deletePageWithUndo } = await import('./actions');
    const { purgeTrash, emptyTrash } = await import('./repos/items');
    const id = await createItem({ kind: 'ink' });
    const keep = await addPage(id);
    const gone = (await loadInk(id)).pages[0]!;
    await saveStrokes(id, [stroke(gone.id), stroke(keep.id)], []);
    await deletePageWithUndo(id, gone.id);
    expect((await db.items.get(id))!.preview).toBe('Handwritten · 1 page');

    await purgeTrash(30, new Date()); // deleted today: kept
    expect(await db.inkPages.get(gone.id)).toBeDefined();
    await purgeTrash(30, new Date(Date.now() + 31 * 86_400_000)); // a month on: gone
    expect(await db.inkPages.get(gone.id)).toBeUndefined();
    expect(await db.strokes.count()).toBe(1);

    await deletePageWithUndo(id, (await addPage(id)).id);
    await emptyTrash();
    expect((await db.inkPages.toArray()).filter((p) => p.deletedAt)).toHaveLength(0);
  });
});

describe('duplicating a typed note', () => {
  it('gives the copy its own pictures, in the text and in its sketches', async () => {
    const { addAttachment, attachmentUrl } = await import('./repos/attachments');
    const { createSketch, sketchUrl, sketchIdFromUrl } = await import('./repos/ink');
    const { setBodyText, emptyTrash, trashItems } = await import('./repos/items');
    const note = await createItem({ kind: 'note', text: 'x' });
    const pic = await addAttachment(note, new Blob(['png'], { type: 'image/png' }), 'a.png');
    const sketch = await createSketch(note);
    const sketchPage = (await loadInk(note, sketch)).pages[0]!;
    const inSketch = await addAttachment(note, new Blob(['jpg'], { type: 'image/jpeg' }), 'b.jpg');
    await saveStrokes(note, [], [], [{ id: newId(), pageId: sketchPage.id, kind: 'image', x: 0, y: 0, w: 10, h: 10, text: '', fontSize: 18, colour: 'black', attachmentId: inSketch.id, createdAt: '' }]);
    await setBodyText(note, `Plan\n\n![a](${attachmentUrl(pic.id)})\n\n![sketch](${sketchUrl(sketch)})`);

    const copy = await duplicateItem(note);
    await trashItems([note]);
    await emptyTrash(); // the original and its pictures are gone for good

    const text = (await db.noteBodies.get(copy))!.text;
    const picId = /ndoco:attachment\/([0-9a-f-]+)/.exec(text)![1]!;
    expect((await db.attachments.get(picId))!.itemId).toBe(copy);
    const copySketch = sketchIdFromUrl(/\((ndoco:ink\/[^)]+)\)/.exec(text)![1]!)!;
    const el = (await loadInk(copy, copySketch)).elements[0]!;
    expect((await db.attachments.get(el.attachmentId!))!.itemId).toBe(copy);
  });
});

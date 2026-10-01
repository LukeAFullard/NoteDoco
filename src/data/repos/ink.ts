import { db } from '../db';
import { touched } from '../meta';
import type { Id, InkDoc, InkPage, Paper, Stroke } from '../types';
import { newId } from '@/lib/ids';
import { compareOrder, orderBetween } from '@/lib/order';
import { DEFAULT_PAPER } from '@/canvas/paper';

/**
 * Ink notes (P3.5): an item of kind "ink" owns one InkDoc, which has ordered pages, which
 * have strokes. Strokes are saved as they're written (autosave), one small record each.
 */

export interface InkContent {
  doc: InkDoc;
  pages: InkPage[];
  strokes: Stroke[];
}

const pagePreview = (n: number) => `Handwritten · ${n} ${n === 1 ? 'page' : 'pages'}`;

/** Creates the document and its first page. Call inside a transaction that includes the ink tables. */
export async function createInkBody(itemId: Id, paper: Paper = DEFAULT_PAPER): Promise<InkDoc> {
  const doc: InkDoc = { id: newId(), itemId, layout: 'pages', paper };
  await db.inkDocs.add(doc);
  await db.inkPages.add({ id: newId(), docId: doc.id, order: orderBetween(null, null), paper, background: null });
  return doc;
}

export const inkPreview = pagePreview;

export async function docFor(itemId: Id): Promise<InkDoc | undefined> {
  return db.inkDocs.where('itemId').equals(itemId).first();
}

export async function listPages(docId: Id): Promise<InkPage[]> {
  return (await db.inkPages.where('docId').equals(docId).toArray()).sort((a, b) => compareOrder(a.order, b.order));
}

/** Everything needed to open an ink note. Creates a missing body (e.g. an item from a newer backup). */
export async function loadInk(itemId: Id): Promise<InkContent> {
  return db.transaction('rw', db.inkDocs, db.inkPages, db.strokes, async () => {
    const doc = (await docFor(itemId)) ?? (await createInkBody(itemId));
    const pages = await listPages(doc.id);
    if (!pages.length) {
      const page: InkPage = { id: newId(), docId: doc.id, order: orderBetween(null, null), paper: doc.paper, background: null };
      await db.inkPages.add(page);
      pages.push(page);
    }
    const strokes = await db.strokes.where('pageId').anyOf(pages.map((p) => p.id)).toArray();
    return { doc, pages, strokes };
  });
}

/** Marks the item as edited (sorting by "updated", sync later). */
async function touchItem(itemId: Id, patch: Partial<{ preview: string }> = {}) {
  const it = await db.items.get(itemId);
  if (it) await db.items.put(touched(it, patch));
}

/** Saves one user action: strokes added and removed. */
export async function saveStrokes(itemId: Id, added: Stroke[], removedIds: Id[]) {
  await db.transaction('rw', db.items, db.strokes, async () => {
    if (removedIds.length) await db.strokes.bulkDelete(removedIds);
    if (added.length) await db.strokes.bulkPut(added);
    await touchItem(itemId);
  });
}

/** Adds a page after `afterId` (or at the end), with the same paper as its neighbour. */
export async function addPage(itemId: Id, afterId: Id | null = null, paper?: Paper): Promise<InkPage> {
  return db.transaction('rw', db.items, db.inkDocs, db.inkPages, async () => {
    const doc = await docFor(itemId);
    if (!doc) throw new Error(`Ink note ${itemId} not found`);
    const pages = await listPages(doc.id);
    const i = afterId ? pages.findIndex((p) => p.id === afterId) : pages.length - 1;
    const before = pages[i];
    const page: InkPage = {
      id: newId(),
      docId: doc.id,
      order: orderBetween(before?.order ?? null, pages[i + 1]?.order ?? null),
      paper: paper ?? before?.paper ?? doc.paper,
      background: null,
    };
    await db.inkPages.add(page);
    await touchItem(itemId, { preview: pagePreview(pages.length + 1) });
    return page;
  });
}

/** Changes the paper of some pages (all of them when `pageIds` is omitted) and the default for new pages. */
export async function setPaper(itemId: Id, paper: Paper, pageIds?: Id[]) {
  await db.transaction('rw', db.items, db.inkDocs, db.inkPages, async () => {
    const doc = await docFor(itemId);
    if (!doc) return;
    const pages = await listPages(doc.id);
    for (const p of pages) if (!pageIds || pageIds.includes(p.id)) await db.inkPages.put({ ...p, paper });
    if (!pageIds) await db.inkDocs.put({ ...doc, paper });
    await touchItem(itemId);
  });
}

/** Copies an ink body to another item (Duplicate). */
export async function copyInk(fromItemId: Id, toItemId: Id) {
  await db.transaction('rw', db.inkDocs, db.inkPages, db.strokes, async () => {
    const src = await docFor(fromItemId);
    await deleteInkBodies([toItemId]);
    if (!src) return;
    const doc: InkDoc = { ...src, id: newId(), itemId: toItemId };
    await db.inkDocs.add(doc);
    for (const p of await listPages(src.id)) {
      const pageId = newId();
      await db.inkPages.add({ ...p, id: pageId, docId: doc.id });
      const strokes = await db.strokes.where('pageId').equals(p.id).toArray();
      // Fresh ids, in the same order (ids are time-ordered and set z-order).
      strokes.sort((a, b) => (a.id < b.id ? -1 : 1));
      await db.strokes.bulkAdd(strokes.map((s) => ({ ...s, id: newId(), pageId })));
    }
  });
}

/** How many strokes an ink note has (empty notes can be discarded). */
export async function strokeCount(itemId: Id): Promise<number> {
  const doc = await docFor(itemId);
  if (!doc) return 0;
  const pages = await db.inkPages.where('docId').equals(doc.id).primaryKeys();
  return db.strokes.where('pageId').anyOf(pages).count();
}

/** Permanently removes the ink bodies of items. Only purging the Trash calls this. */
export async function deleteInkBodies(itemIds: Id[]) {
  const docs = await db.inkDocs.where('itemId').anyOf(itemIds).toArray();
  if (!docs.length) return;
  const pages = await db.inkPages.where('docId').anyOf(docs.map((d) => d.id)).primaryKeys();
  await db.strokes.where('pageId').anyOf(pages).delete();
  await db.inkPages.bulkDelete(pages);
  await db.inkDocs.bulkDelete(docs.map((d) => d.id));
}

/** A deleted page with its strokes, kept so the deletion can be undone. */
export interface PageSnapshot {
  itemId: Id;
  page: InkPage;
  strokes: Stroke[];
}

/** Deletes a page and its strokes. A note always keeps at least one page. */
export async function deletePage(itemId: Id, pageId: Id): Promise<PageSnapshot | null> {
  return db.transaction('rw', db.items, db.inkDocs, db.inkPages, db.strokes, async () => {
    const page = await db.inkPages.get(pageId);
    if (!page || (await db.inkPages.where('docId').equals(page.docId).count()) < 2) return null;
    const strokes = await db.strokes.where('pageId').equals(pageId).toArray();
    await db.strokes.where('pageId').equals(pageId).delete();
    await db.inkPages.delete(pageId);
    await touchItem(itemId, { preview: pagePreview(await db.inkPages.where('docId').equals(page.docId).count()) });
    return { itemId, page, strokes };
  });
}

export async function restorePage(snap: PageSnapshot) {
  await db.transaction('rw', db.items, db.inkPages, db.strokes, async () => {
    await db.inkPages.put(snap.page);
    await db.strokes.bulkPut(snap.strokes);
    await touchItem(snap.itemId, { preview: pagePreview(await db.inkPages.where('docId').equals(snap.page.docId).count()) });
  });
}

/** Moves a page before `beforeId` (null = to the end). Returns its old order key. */
export async function movePage(itemId: Id, pageId: Id, beforeId: Id | null): Promise<string | null> {
  return db.transaction('rw', db.items, db.inkPages, async () => {
    const page = await db.inkPages.get(pageId);
    if (!page) return null;
    const others = (await listPages(page.docId)).filter((p) => p.id !== pageId);
    const i = beforeId ? others.findIndex((p) => p.id === beforeId) : others.length;
    const at = i < 0 ? others.length : i;
    await db.inkPages.put({ ...page, order: orderBetween(others[at - 1]?.order ?? null, others[at]?.order ?? null) });
    await touchItem(itemId);
    return page.order;
  });
}

export async function setPageOrder(itemId: Id, pageId: Id, order: string) {
  await db.transaction('rw', db.items, db.inkPages, async () => {
    await db.inkPages.update(pageId, { order });
    await touchItem(itemId);
  });
}

/** Copies a page (and its ink) to just after it. */
export async function duplicatePage(itemId: Id, pageId: Id): Promise<InkPage | null> {
  return db.transaction('rw', db.items, db.inkDocs, db.inkPages, db.strokes, async () => {
    const page = await db.inkPages.get(pageId);
    if (!page) return null;
    const copy = await addPage(itemId, pageId, page.paper);
    const strokes = (await db.strokes.where('pageId').equals(pageId).toArray()).sort((a, b) => (a.id < b.id ? -1 : 1));
    await db.strokes.bulkAdd(strokes.map((s) => ({ ...s, id: newId(), pageId: copy.id })));
    return copy;
  });
}

/** Removes a page made by duplicatePage or addPage (their undo). */
export async function removePage(itemId: Id, pageId: Id) {
  await db.transaction('rw', db.items, db.inkDocs, db.inkPages, db.strokes, async () => {
    const page = await db.inkPages.get(pageId);
    if (!page) return;
    await db.strokes.where('pageId').equals(pageId).delete();
    await db.inkPages.delete(pageId);
    await touchItem(itemId, { preview: pagePreview(await db.inkPages.where('docId').equals(page.docId).count()) });
  });
}

/** The current paper of each page (to undo a paper change). */
export async function paperOf(itemId: Id): Promise<{ doc: Paper; pages: Record<Id, Paper> } | null> {
  const doc = await docFor(itemId);
  if (!doc) return null;
  return { doc: doc.paper, pages: Object.fromEntries((await listPages(doc.id)).map((p) => [p.id, p.paper])) };
}

export async function restorePaper(itemId: Id, saved: { doc: Paper; pages: Record<Id, Paper> }) {
  await db.transaction('rw', db.items, db.inkDocs, db.inkPages, async () => {
    const doc = await docFor(itemId);
    if (!doc) return;
    await db.inkDocs.put({ ...doc, paper: saved.doc });
    for (const [id, paper] of Object.entries(saved.pages)) await db.inkPages.update(id, { paper });
    await touchItem(itemId);
  });
}

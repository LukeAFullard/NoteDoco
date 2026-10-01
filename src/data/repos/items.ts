import { db } from '../db';
import { freshMeta, touched } from '../meta';
import type { Id, Item, ItemKind, NoteBody, StickyBody, TimeSpan } from '../types';
import { compareOrder, orderBetween } from '@/lib/order';
import { nowIso } from '@/lib/ids';
import type { ColourKey } from '@/lib/palette';
import { analyseText } from '@/lib/textInfo';
import { taskRefsFor } from '../taskRefs';
import { copyInk, createInkBody, deleteInkBodies, inkPreview, strokeCount } from './ink';

export const TRASH_RETENTION_DAYS = 30;

export interface NewItem {
  kind: ItemKind;
  groupId?: Id | null;
  title?: string;
  colour?: ColourKey | null;
  text?: string;
  format?: NoteBody['format'];
  size?: StickyBody['size'];
  when?: TimeSpan | null;
  due?: TimeSpan | null;
  /** Make it a to-do (a checkbox on the item itself). */
  task?: boolean;
}

function blankItem(kind: ItemKind, groupId: Id | null, order: string): Item {
  return {
    ...freshMeta(),
    kind,
    groupId,
    order,
    title: '',
    preview: '',
    colour: null,
    tags: [],
    manualTags: [],
    pinned: false,
    archived: false,
    when: null,
    due: null,
    reminders: [],
    recurrence: null,
    task: null,
    stats: { checklistTotal: 0, checklistDone: 0, words: 0 },
    thumbnailId: null,
  };
}

/** Items in a group (null = Inbox), live only, in manual order. */
export async function listItems(groupId: Id | null): Promise<Item[]> {
  const rows = groupId
    ? await db.items.where('groupId').equals(groupId).toArray()
    : (await db.items.toArray()).filter((i) => i.groupId === null);
  return rows.filter((i) => !i.deletedAt).sort((a, b) => compareOrder(a.order, b.order));
}

export async function listTrash(): Promise<Item[]> {
  const rows = await db.items.where('deletedAt').above('').toArray();
  return rows.sort((a, b) => (a.deletedAt! < b.deletedAt! ? 1 : -1));
}

/** Merges tags from the tag picker with #tags found in the text. */
export const mergeTags = (manual: string[], inline: string[]): string[] => [...new Set([...manual, ...inline])].sort();

async function syncTaskRefs(itemId: Id, text: string) {
  await db.taskRefs.where('itemId').equals(itemId).delete();
  const refs = taskRefsFor(itemId, text);
  if (refs.length) await db.taskRefs.bulkAdd(refs);
}

/** Fields derived from a body, so lists never parse bodies. */
function derivedFields(item: Item, text: string, format: NoteBody['format']): Partial<Item> {
  const info = analyseText(text, format);
  return {
    title: info.title,
    preview: info.preview,
    tags: mergeTags(item.manualTags, info.tags),
    stats: { checklistTotal: info.checklistTotal, checklistDone: info.checklistDone, words: info.words },
  };
}

export async function createItem(input: NewItem): Promise<Id> {
  const groupId = input.groupId ?? null;
  const last = (await listItems(groupId)).at(-1);
  const item = blankItem(input.kind, groupId, orderBetween(last?.order ?? null, null));
  const text = input.text ?? '';
  Object.assign(item, derivedFields(item, text, input.format ?? 'markdown'));
  if (input.title !== undefined) item.title = input.title;
  item.colour = input.colour ?? null;
  item.when = input.when ?? null;
  item.due = input.due ?? null;
  if (input.task) item.task = { done: false, doneAt: null };
  if (input.kind === 'ink') item.preview = inkPreview(1);

  await db.transaction('rw', [db.items, db.noteBodies, db.stickyBodies, db.taskRefs, db.inkDocs, db.inkPages], async () => {
    await db.items.add(item);
    await syncTaskRefs(item.id, text);
    if (input.kind === 'note') {
      await db.noteBodies.add({ itemId: item.id, format: input.format ?? 'markdown', text });
    } else if (input.kind === 'sticky') {
      await db.stickyBodies.add({ itemId: item.id, text, inkPageId: null, size: input.size ?? 'M', stuckTo: null });
    } else if (input.kind === 'ink') {
      await createInkBody(item.id);
    }
  });
  return item.id;
}

export async function updateItem(id: Id, patch: Partial<Omit<Item, keyof import('../types').Meta | 'kind'>>) {
  await db.transaction('rw', db.items, async () => {
    const it = await db.items.get(id);
    if (!it) throw new Error(`Item ${id} not found`);
    await db.items.put(touched(it, patch));
  });
}

/** Saves a note or sticky body and refreshes the derived title/preview/stats/tags. */
export async function setBodyText(id: Id, text: string, format?: NoteBody['format']) {
  await db.transaction('rw', db.items, db.noteBodies, db.stickyBodies, db.taskRefs, async () => {
    const it = await db.items.get(id);
    if (!it) throw new Error(`Item ${id} not found`);
    let fmt: NoteBody['format'] = 'markdown';
    if (it.kind === 'note') {
      const body = await db.noteBodies.get(id);
      fmt = format ?? body?.format ?? 'markdown';
      await db.noteBodies.put({ itemId: id, format: fmt, text });
    } else if (it.kind === 'sticky') {
      await db.stickyBodies.update(id, { text });
    } else throw new Error(`Item kind ${it.kind} has no text body`);
    await db.items.put(touched(it, derivedFields(it, text, fmt)));
    await syncTaskRefs(id, text);
  });
}

/** Replaces the tags added with the tag picker (text #tags are kept). */
export async function setManualTags(id: Id, manualTags: string[]) {
  await db.transaction('rw', db.items, async () => {
    const it = await db.items.get(id);
    if (!it) throw new Error(`Item ${id} not found`);
    const clean = [...new Set(manualTags.map((t) => t.trim().replace(/^#/, '').toLowerCase()).filter(Boolean))].sort();
    const inline = it.tags.filter((t) => !it.manualTags.includes(t));
    await db.items.put(touched(it, { manualTags: clean, tags: mergeTags(clean, inline) }));
  });
}

/** Copies an item and its body into the same group, right after the original. */
export async function duplicateItem(id: Id): Promise<Id> {
  const it = await db.items.get(id);
  if (!it) throw new Error(`Item ${id} not found`);
  const note = it.kind === 'note' ? await db.noteBodies.get(id) : undefined;
  const sticky = it.kind === 'sticky' ? await db.stickyBodies.get(id) : undefined;
  const copyId = await createItem({
    kind: it.kind,
    groupId: it.groupId,
    colour: it.colour,
    text: note?.text ?? sticky?.text ?? '',
    format: note?.format,
    size: sticky?.size,
  });
  if (it.kind === 'ink') await copyInk(id, copyId);
  await db.transaction('rw', db.items, async () => {
    const copy = (await db.items.get(copyId))!;
    const sibs = await listItems(it.groupId);
    const next = sibs[sibs.findIndex((s) => s.id === id) + 1];
    const order = next && next.id !== copyId ? orderBetween(it.order, next.order) : copy.order;
    await db.items.put({ ...copy, order, title: it.kind === 'ink' ? it.title : copy.title, preview: it.kind === 'ink' ? it.preview : copy.preview, manualTags: it.manualTags, tags: it.tags, when: it.when, due: it.due, task: it.task && { done: false, doneAt: null } });
  });
  return copyId;
}

/** Moves an item to a group (null = Inbox), before `beforeId` or last. */
export async function moveItem(id: Id, groupId: Id | null, beforeId: Id | null = null) {
  await db.transaction('rw', db.items, async () => {
    const it = await db.items.get(id);
    if (!it) throw new Error(`Item ${id} not found`);
    const sibs = (await listItems(groupId)).filter((s) => s.id !== id);
    const idx = beforeId ? sibs.findIndex((s) => s.id === beforeId) : sibs.length;
    const at = idx < 0 ? sibs.length : idx;
    await db.items.put(touched(it, { groupId, order: orderBetween(sibs[at - 1]?.order ?? null, sibs[at]?.order ?? null) }));
  });
}

export async function trashItems(ids: Id[]): Promise<void> {
  const stamp = nowIso();
  await db.transaction('rw', db.items, async () => {
    for (const id of ids) {
      const it = await db.items.get(id);
      if (it && !it.deletedAt) await db.items.put(touched(it, { deletedAt: stamp }, stamp));
    }
  });
}

export async function restoreItems(ids: Id[]): Promise<void> {
  await db.transaction('rw', db.items, db.groups, async () => {
    for (const id of ids) {
      const it = await db.items.get(id);
      if (!it?.deletedAt) continue;
      // If its group is gone, restore into the Inbox rather than into the trash.
      const group = it.groupId ? await db.groups.get(it.groupId) : null;
      const groupId = group && !group.deletedAt ? it.groupId : null;
      await db.items.put(touched(it, { deletedAt: null, groupId }));
    }
  });
}

/** Permanently deletes items and everything that belongs to them. Only the Trash calls this. */
export async function deleteItemsForever(ids: Id[]): Promise<void> {
  await db.transaction('rw', [db.items, db.noteBodies, db.stickyBodies, db.versions, db.attachments, db.links, db.taskRefs, db.inkDocs, db.inkPages, db.strokes, db.inkElements], async () => {
    await db.items.bulkDelete(ids);
    await deleteInkBodies(ids);
    await db.noteBodies.bulkDelete(ids);
    await db.stickyBodies.bulkDelete(ids);
    await db.versions.where('itemId').anyOf(ids).delete();
    await db.attachments.where('itemId').anyOf(ids).delete();
    await db.links.where('fromItemId').anyOf(ids).delete();
    await db.links.where('toItemId').anyOf(ids).delete();
    await db.taskRefs.where('itemId').anyOf(ids).delete();
  });
}

/** Permanently removes items and groups trashed more than `days` ago. Returns how many items went. */
export async function purgeTrash(days = TRASH_RETENTION_DAYS, now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - days * 86_400_000).toISOString();
  const old = await db.items.where('deletedAt').between('', cutoff, false, true).primaryKeys();
  await deleteItemsForever(old);
  const oldGroups = await db.groups.where('deletedAt').between('', cutoff, false, true).primaryKeys();
  await db.groups.bulkDelete(oldGroups);
  return old.length;
}

/** Empties the Trash now: every trashed item and group, for good. */
export async function emptyTrash(): Promise<number> {
  const items = await db.items.where('deletedAt').above('').primaryKeys();
  await deleteItemsForever(items);
  await db.groups.where('deletedAt').above('').delete();
  return items.length;
}

/**
 * Removes an item that was created but never given any content (e.g. a new sticky closed
 * straight away). It never had anything to restore, so it skips the Trash.
 */
export async function discardIfEmpty(id: Id): Promise<boolean> {
  return db.transaction('rw', [db.items, db.noteBodies, db.stickyBodies, db.inkDocs, db.inkPages, db.strokes, db.inkElements], async () => {
    const it = await db.items.get(id);
    if (!it) return false;
    if (it.kind === 'ink') {
      if (it.title.trim() || it.manualTags.length || it.when || it.due || (await strokeCount(id))) return false;
      await deleteInkBodies([id]);
      await db.items.delete(id);
      return true;
    }
    const text = it.kind === 'note' ? (await db.noteBodies.get(id))?.text : (await db.stickyBodies.get(id))?.text;
    if ((text ?? '').trim() || it.manualTags.length || it.when || it.due) return false;
    await db.items.delete(id);
    await db.noteBodies.delete(id);
    await db.stickyBodies.delete(id);
    return true;
  });
}

export async function setStickySize(id: Id, size: StickyBody['size']) {
  await db.stickyBodies.update(id, { size });
  const it = await db.items.get(id);
  if (it) await db.items.put(touched(it, {}));
}

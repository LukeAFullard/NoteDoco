import { db } from '../db';
import { freshMeta, touched } from '../meta';
import type { Id, Item, ItemKind, NoteBody, StickyBody } from '../types';
import { compareOrder, orderBetween } from '@/lib/order';
import { nowIso } from '@/lib/ids';
import type { ColourKey } from '@/lib/palette';

export const TRASH_RETENTION_DAYS = 30;

export interface NewItem {
  kind: ItemKind;
  groupId?: Id | null;
  title?: string;
  colour?: ColourKey | null;
  text?: string;
  format?: NoteBody['format'];
  size?: StickyBody['size'];
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

/** Plain-text preview and title derived from a body, so lists never parse bodies. */
export function derive(text: string): { title: string; preview: string; words: number } {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const strip = (s: string) => s.replace(/^#{1,6}\s+|^[-*+]\s+(\[[ xX]\]\s+)?|^>\s+/, '').trim();
  const title = strip(lines[0] ?? '').slice(0, 120);
  const preview = lines.slice(1).map(strip).join(' ').slice(0, 240);
  const words = lines
    .map(strip)
    .join(' ')
    .split(/\s+/)
    .filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  return { title, preview, words };
}

export async function createItem(input: NewItem): Promise<Id> {
  const groupId = input.groupId ?? null;
  const last = (await listItems(groupId)).at(-1);
  const item = blankItem(input.kind, groupId, orderBetween(last?.order ?? null, null));
  const text = input.text ?? '';
  const d = derive(text);
  item.title = input.title ?? d.title;
  item.preview = d.preview;
  item.stats.words = d.words;
  item.colour = input.colour ?? null;

  await db.transaction('rw', db.items, db.noteBodies, db.stickyBodies, async () => {
    await db.items.add(item);
    if (input.kind === 'note') {
      await db.noteBodies.add({ itemId: item.id, format: input.format ?? 'markdown', text });
    } else if (input.kind === 'sticky') {
      await db.stickyBodies.add({ itemId: item.id, text, inkPageId: null, size: input.size ?? 'M', stuckTo: null });
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

/** Saves a note or sticky body and refreshes the derived title/preview/stats. */
export async function setBodyText(id: Id, text: string) {
  await db.transaction('rw', db.items, db.noteBodies, db.stickyBodies, async () => {
    const it = await db.items.get(id);
    if (!it) throw new Error(`Item ${id} not found`);
    const d = derive(text);
    if (it.kind === 'note') await db.noteBodies.update(id, { text });
    else if (it.kind === 'sticky') await db.stickyBodies.update(id, { text });
    else throw new Error(`Item kind ${it.kind} has no text body`);
    await db.items.put(touched(it, { title: d.title, preview: d.preview, stats: { ...it.stats, words: d.words } }));
  });
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

/** Permanently removes items trashed more than `days` ago, with their bodies. Returns the count. */
export async function purgeTrash(days = TRASH_RETENTION_DAYS, now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - days * 86_400_000).toISOString();
  return db.transaction('rw', [db.items, db.noteBodies, db.stickyBodies, db.versions, db.attachments], async () => {
    const old = await db.items.where('deletedAt').between('', cutoff, false, true).primaryKeys();
    await db.items.bulkDelete(old);
    await db.noteBodies.bulkDelete(old);
    await db.stickyBodies.bulkDelete(old);
    await db.versions.where('itemId').anyOf(old).delete();
    await db.attachments.where('itemId').anyOf(old).delete();
    return old.length;
  });
}

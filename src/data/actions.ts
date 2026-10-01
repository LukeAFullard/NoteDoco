import { recordUndo } from './undo';
import { createItem, duplicateItem, moveItem, restoreItems, trashItems, updateItem } from './repos/items';
import { moveGroup, restoreGroup, trashGroup, updateGroup } from './repos/groups';
import { db } from './db';
import { touched } from './meta';
import type { Id, Item, LocalDate, Paper, TimeSpan } from './types';
import * as ink from './repos/ink';
import type { ColourKey } from '@/lib/palette';
import { completeItem, getBodyText, reopenItem, setChecklistLineDate, toggleChecklistLine, type CompleteResult } from './repos/time';
import { setBodyText } from './repos/items';
import { addDays, allDaySpan, diffDays, formatDay, formatSpan, shiftSpan, spanDays, spanStart } from '@/lib/time';

/**
 * User-facing actions: the repository call plus an undo entry. Each returns the toast message,
 * so the caller can show it with an Undo button.
 */

const plural = (n: number, one: string, many: string) => (n === 1 ? one : `${n} ${many}`);

export async function trashItemsWithUndo(ids: Id[]): Promise<string> {
  await trashItems(ids);
  const label = ids.length === 1 ? 'Moved to Trash' : `Moved ${ids.length} items to Trash`;
  recordUndo({ label, undo: () => restoreItems(ids), redo: () => trashItems(ids) });
  return label;
}

/** Moves items to a group (null = Inbox); undo puts each back exactly where it was. */
export async function moveItemsWithUndo(ids: Id[], groupId: Id | null): Promise<string> {
  const before = (await db.items.bulkGet(ids)).filter((i): i is Item => !!i);
  for (const id of ids) await moveItem(id, groupId);
  const target = groupId ? (await db.groups.get(groupId))?.name ?? 'group' : 'Inbox';
  const label = `Moved ${plural(ids.length, 'item', 'items')} to ${target}`;
  recordUndo({
    label,
    undo: async () => {
      for (const b of before) {
        const now = await db.items.get(b.id);
        if (now) await db.items.put(touched(now, { groupId: b.groupId, order: b.order }));
      }
    },
    redo: async () => {
      for (const id of ids) await moveItem(id, groupId);
    },
  });
  return label;
}

/** Kept for existing callers: single-item move. */
export const moveItemWithUndo = (id: Id, groupId: Id | null) => moveItemsWithUndo([id], groupId);

async function setFieldWithUndo<K extends 'pinned' | 'colour' | 'archived'>(ids: Id[], field: K, value: Item[K], label: string) {
  const before = (await db.items.bulkGet(ids)).filter((i): i is Item => !!i).map((i) => [i.id, i[field]] as const);
  for (const id of ids) await updateItem(id, { [field]: value } as Partial<Item>);
  recordUndo({
    label,
    undo: async () => {
      for (const [id, v] of before) await updateItem(id, { [field]: v } as Partial<Item>);
    },
    redo: async () => {
      for (const id of ids) await updateItem(id, { [field]: value } as Partial<Item>);
    },
  });
  return label;
}

export const setPinnedWithUndo = (ids: Id[], pinned: boolean) =>
  setFieldWithUndo(ids, 'pinned', pinned, pinned ? `Pinned ${plural(ids.length, 'item', 'items')}` : 'Unpinned');

export const setColourWithUndo = (ids: Id[], colour: ColourKey | null) => setFieldWithUndo(ids, 'colour', colour, 'Colour changed');

export const setArchivedWithUndo = (ids: Id[], archived: boolean) =>
  setFieldWithUndo(ids, 'archived', archived, archived ? `Archived ${plural(ids.length, 'item', 'items')}` : 'Unarchived');

export async function duplicateWithUndo(id: Id): Promise<{ id: Id; label: string }> {
  const copy = await duplicateItem(id);
  recordUndo({ label: 'Duplicated', undo: () => trashItems([copy]), redo: () => restoreItems([copy]) });
  return { id: copy, label: 'Duplicated' };
}

export async function trashGroupWithUndo(id: Id): Promise<string> {
  await trashGroup(id);
  recordUndo({ label: 'Group moved to Trash', undo: () => restoreGroup(id), redo: async () => void (await trashGroup(id)) });
  return 'Group moved to Trash';
}

export async function archiveGroupWithUndo(id: Id, archived: boolean): Promise<string> {
  await updateGroup(id, { archived });
  const label = archived ? 'Group archived' : 'Group unarchived';
  recordUndo({ label, undo: () => updateGroup(id, { archived: !archived }), redo: () => updateGroup(id, { archived }) });
  return label;
}

export { createItem };

/** Moves a group under `parentId` (null = top level), before `beforeId` or last; undoable. */
export async function moveGroupWithUndo(id: Id, parentId: Id | null, beforeId: Id | null = null): Promise<string> {
  const before = await db.groups.get(id);
  if (!before) throw new Error(`Group ${id} not found`);
  await moveGroup(id, parentId, beforeId);
  const label = 'Group moved';
  recordUndo({
    label,
    undo: async () => {
      const now = await db.groups.get(id);
      if (now) await db.groups.put(touched(now, { parentId: before.parentId, order: before.order }));
    },
    redo: () => moveGroup(id, parentId, beforeId),
  });
  return label;
}

// ---------------------------------------------------------------------------------------------
// Time (Phase 2): dates, done, repeats

type TimeFields = Pick<Item, 'when' | 'due' | 'reminders' | 'recurrence' | 'task' | 'groupId' | 'colour'>;
const timeFields = (i: Item): TimeFields => ({ when: i.when, due: i.due, reminders: i.reminders, recurrence: i.recurrence, task: i.task, groupId: i.groupId, colour: i.colour });

async function restoreFields(snapshot: [Id, TimeFields][]) {
  for (const [id, fields] of snapshot) {
    const now = await db.items.get(id);
    if (now) await db.items.put(touched(now, fields));
  }
}

/** Sets dates, reminders, repeats, the to-do checkbox or the group on items, undoably. */
export async function setTimeWithUndo(ids: Id[], patch: Partial<TimeFields>, label = 'Date changed'): Promise<string> {
  const before = (await db.items.bulkGet(ids)).filter((i): i is Item => !!i).map((i) => [i.id, timeFields(i)] as [Id, TimeFields]);
  for (const id of ids) await updateItem(id, patch);
  recordUndo({
    label,
    undo: () => restoreFields(before),
    redo: async () => {
      for (const id of ids) await updateItem(id, patch);
    },
  });
  return label;
}

/**
 * Marks an item done (or, for a repeat, moves it to its next date). Undo puts back its dates,
 * checkbox and checklist, and trashes a template's fresh copy.
 */
export async function completeWithUndo(id: Id): Promise<{ label: string; result: CompleteResult }> {
  const item = await db.items.get(id);
  if (!item) throw new Error(`Item ${id} not found`);
  const text = await getBodyText(id);
  const result = await completeItem(id);
  const label =
    result.kind === 'done' ? 'Done'
    : result.kind === 'next' ? `Done. Next: ${formatDay(result.next)}`
    : 'Started a fresh copy';
  recordUndo({
    label,
    undo: async () => {
      await restoreFields([[id, timeFields(item)]]);
      if (text !== null && (await getBodyText(id)) !== text) await setBodyText(id, text);
      if (result.kind === 'copied') await trashItems([result.copyId]);
    },
    redo: async () => void (await completeItem(id)),
  });
  return { label, result };
}

/** Ticks or unticks an item's own checkbox. Ticking a repeating item moves it on instead. */
export async function toggleDoneWithUndo(id: Id): Promise<string> {
  const item = await db.items.get(id);
  if (!item) throw new Error(`Item ${id} not found`);
  if (!item.task?.done) return (await completeWithUndo(id)).label;
  await reopenItem(id);
  recordUndo({ label: 'Not done', undo: () => restoreFields([[id, timeFields(item)]]), redo: () => reopenItem(id) });
  return 'Not done';
}

/** Ticks or unticks one checklist line inside a note or sticky. */
export async function toggleChecklistLineWithUndo(itemId: Id, index: number, done: boolean): Promise<string> {
  await toggleChecklistLine(itemId, index);
  const label = done ? 'Unticked' : 'Ticked';
  recordUndo({ label, undo: () => toggleChecklistLine(itemId, index), redo: () => toggleChecklistLine(itemId, index) });
  return label;
}

/**
 * Applies the change from one span to another onto a stored span. For a repeat's later
 * occurrence, `from` is that occurrence and `stored` the series' own date, so dragging any
 * occurrence moves (or stretches) the whole series by the same amount.
 */
export function applySpanChange(stored: TimeSpan, from: TimeSpan, to: TimeSpan): TimeSpan {
  if (stored.allDay && from.allDay && to.allDay) {
    const startDays = diffDays(from.start, to.start);
    const endDays = diffDays(from.end ?? from.start, to.end ?? to.start);
    return allDaySpan(addDays(stored.start, startDays), addDays(stored.end ?? stored.start, endDays));
  }
  if (!stored.allDay && !from.allDay && !to.allDay) {
    const startMs = Date.parse(to.start) - Date.parse(from.start);
    const endMs = Date.parse(to.end ?? to.start) - Date.parse(from.end ?? from.start);
    const start = new Date(Date.parse(stored.start) + startMs);
    const end = new Date(Date.parse(stored.end ?? stored.start) + endMs);
    return { ...stored, start: start.toISOString(), end: end > start ? end.toISOString() : null };
  }
  return to;
}

/**
 * Moves or resizes an item on the timeline or calendar (TIME-6), optionally into another
 * group or colour, keeping reminders the same distance from it. Undoable.
 */
export async function rescheduleWithUndo(
  item: Item,
  basis: 'when' | 'due' | 'created',
  from: TimeSpan,
  to: TimeSpan,
  extra: Partial<Pick<Item, 'groupId' | 'colour'>> = {},
): Promise<string> {
  const field = basis === 'due' ? 'due' : 'when';
  const stored = item[field];
  const next = stored && basis !== 'created' ? applySpanChange(stored, from, to) : to;
  const shiftMs = spanStart(next).getTime() - (stored ? spanStart(stored).getTime() : spanStart(next).getTime());
  const reminders = item.reminders.map((r) => ({ ...r, at: new Date(Date.parse(r.at) + shiftMs).toISOString(), firedAt: null }));
  let label = `Moved to ${formatSpan(to)}`;
  if (extra.groupId !== undefined && extra.groupId !== item.groupId) {
    label += ` in ${extra.groupId ? ((await db.groups.get(extra.groupId))?.name ?? 'a group') : 'Inbox'}`;
  }
  if (extra.colour !== undefined && extra.colour !== item.colour && extra.groupId === undefined) label += ', colour changed';
  return setTimeWithUndo([item.id], { [field]: next, reminders, ...extra }, label);
}

/**
 * Puts items on a day (dropped onto a calendar day, the timeline or Today): dated items move
 * there keeping their time and length; undated ones get that day. Undoable.
 */
export async function dateItemsWithUndo(ids: Id[], day: LocalDate, extra: Partial<Pick<Item, 'groupId' | 'colour'>> = {}): Promise<string> {
  const items = (await db.items.bulkGet(ids)).filter((i): i is Item => !!i);
  const before = items.map((i) => [i.id, timeFields(i)] as [Id, TimeFields]);
  const apply = async () => {
    for (const it of items) {
      const field = it.when || !it.due ? 'when' : 'due';
      const span = it[field];
      const next = span ? shiftSpan(span, diffDays(spanDays(span)[0], day)) : allDaySpan(day);
      const shiftMs = span ? spanStart(next).getTime() - spanStart(span).getTime() : 0;
      await updateItem(it.id, {
        [field]: next,
        reminders: it.reminders.map((r) => ({ ...r, at: new Date(Date.parse(r.at) + shiftMs).toISOString(), firedAt: null })),
        ...extra,
      });
    }
  };
  await apply();
  const label = `${items.length === 1 ? 'Moved' : `Moved ${items.length} items`} to ${formatDay(day)}`;
  recordUndo({ label, undo: () => restoreFields(before), redo: apply });
  return label;
}

/** Moves a dated checklist line to another date by rewriting its @date (NOTE-9). Undoable. */
export async function moveChecklistLineWithUndo(itemId: Id, index: number, date: string): Promise<string> {
  const before = await getBodyText(itemId);
  await setChecklistLineDate(itemId, index, date);
  const label = `Moved to ${formatDay(date.slice(0, 10))}`;
  recordUndo({
    label,
    undo: async () => {
      if (before !== null) await setBodyText(itemId, before);
    },
    redo: () => setChecklistLineDate(itemId, index, date),
  });
  return label;
}

/**
 * Reschedules any timeline or calendar entry: an item (with its repeat series), or a dated
 * checklist line, whose @date is rewritten (lines keep their group and colour).
 */
export async function reschedulePlacedWithUndo(
  placed: { item: Item; basis: 'when' | 'due' | 'created'; line?: { itemId: Id; anchor: string } },
  from: TimeSpan,
  to: TimeSpan,
  extra: Partial<Pick<Item, 'groupId' | 'colour'>> = {},
): Promise<string> {
  if (!placed.line) return rescheduleWithUndo(placed.item, placed.basis, from, to, extra);
  const d = spanStart(to);
  const pad = (n: number) => String(n).padStart(2, '0');
  const day = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return moveChecklistLineWithUndo(placed.line.itemId, Number(placed.line.anchor), to.allDay ? to.start : `${day}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
}

// ---- Ink pages (P3.5) ---------------------------------------------------------

export async function deletePageWithUndo(itemId: Id, pageId: Id): Promise<string | null> {
  const snap = await ink.deletePage(itemId, pageId);
  if (!snap) return null;
  recordUndo({ label: 'Delete page', undo: () => ink.restorePage(snap), redo: async () => void (await ink.deletePage(itemId, pageId)) });
  return 'Page deleted';
}

export async function movePageWithUndo(itemId: Id, pageId: Id, beforeId: Id | null): Promise<string | null> {
  const old = await ink.movePage(itemId, pageId, beforeId);
  if (old === null) return null;
  const moved = (await db.inkPages.get(pageId))!.order;
  recordUndo({ label: 'Move page', undo: () => ink.setPageOrder(itemId, pageId, old), redo: () => ink.setPageOrder(itemId, pageId, moved) });
  return 'Page moved';
}

export async function duplicatePageWithUndo(itemId: Id, pageId: Id): Promise<{ label: string; pageId: Id } | null> {
  const copy = await ink.duplicatePage(itemId, pageId);
  if (!copy) return null;
  const strokes = await db.strokes.where('pageId').equals(copy.id).toArray();
  recordUndo({
    label: 'Duplicate page',
    undo: () => ink.removePage(itemId, copy.id),
    redo: () => ink.restorePage({ itemId, page: copy, strokes }),
  });
  return { label: 'Page duplicated', pageId: copy.id };
}

export async function setPaperWithUndo(itemId: Id, paper: Paper, pageIds?: Id[]): Promise<string> {
  const before = await ink.paperOf(itemId);
  await ink.setPaper(itemId, paper, pageIds);
  if (before) recordUndo({ label: 'Change paper', undo: () => ink.restorePaper(itemId, before), redo: () => ink.setPaper(itemId, paper, pageIds) });
  return 'Paper changed';
}

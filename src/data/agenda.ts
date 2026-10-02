import { db } from './db';
import type { Item, LocalDate, TaskRef, TimeSpan } from './types';
import { addDays, diffDays, isDone, isOverdue, itemSpan, shiftSpan, spanDays, spanStart, todayLocal } from '@/lib/time';
import { occurrencesBetween, parseRule } from '@/lib/recurrence';
import { mentionDay, stripMentions } from '@/lib/dateMentions';

/**
 * Date queries shared by Today, Tasks, the timeline and the calendar (ARCHITECTURE §10).
 * Range queries run on the `when.start` / `due.start` / `createdAt` indexes; repeating items
 * come from the `recurrence` index and are expanded into occurrences.
 */

export interface Placed {
  item: Item;
  /** Where this entry sits: the item's own span, or a repeat's later occurrence. */
  span: TimeSpan;
  /** A projected repeat (not the item's stored date): shown lighter, dragging edits the series. */
  projected: boolean;
  /** Why it's here: its date, its due date, or (undated items, when asked) its created date. */
  basis: 'when' | 'due' | 'created';
  /**
   * Set for a dated checklist line (NOTE-9): `item` is then its note or sticky, with the
   * line's text as the title and its tick as the to-do state.
   */
  line?: TaskRef;
}

/** A stable key for an entry (an item can appear several times: repeats, checklist lines). */
export const placedKey = (p: Placed) => (p.line ? `line:${p.line.id}` : `${p.item.id}@${p.span.start}`);

/**
 * How far back to look for long spans that started before the window (a project running for
 * months must still show in this week). Two years covers anything realistic.
 */
const LOOKBACK_DAYS = 731;

const live = (i: Item, includeArchived: boolean) => !i.deletedAt && (includeArchived || !i.archived);

function overlaps(span: TimeSpan, from: LocalDate, to: LocalDate) {
  const [a, b] = spanDays(span);
  return a <= to && b >= from;
}

export interface PlacedOptions {
  /** Also place undated items at their created date (TIME-7). */
  undated?: boolean;
  includeArchived?: boolean;
  /** Expand repeats into their future occurrences (default true). */
  repeats?: boolean;
  /** Include dated checklist lines (NOTE-9). */
  lines?: boolean;
}

/** Everything dated within [from, to] (inclusive local dates), with repeats expanded. */
export async function placedBetween(from: LocalDate, to: LocalDate, opts: PlacedOptions = {}): Promise<Placed[]> {
  const { undated = false, includeArchived = false, repeats = true, lines = false } = opts;
  // Keys mix LocalDates and UTC instants, so widen by a day on each side and filter exactly.
  const lo = addDays(from, -LOOKBACK_DAYS);
  const hi = `${addDays(to, 1)}￿`;
  const [byWhen, byDue, repeating] = await Promise.all([
    db.items.where('when.start').between(lo, hi, true, true).toArray(),
    db.items.where('due.start').between(lo, hi, true, true).toArray(),
    repeats ? db.items.where('recurrence').above('').toArray() : Promise.resolve([] as Item[]),
  ]);
  const seen = new Set<string>();
  const out: Placed[] = [];
  const push = (p: Placed) => {
    const key = `${p.item.id}@${p.span.start}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(p);
  };

  for (const item of [...byWhen, ...byDue]) {
    if (!live(item, includeArchived) || (repeats && item.recurrence)) continue;
    const span = itemSpan(item)!;
    if (overlaps(span, from, to)) push({ item, span, projected: false, basis: item.when ? 'when' : 'due' });
  }

  for (const item of repeating) {
    const span = itemSpan(item);
    const rule = parseRule(item.recurrence);
    if (!span || !live(item, includeArchived)) continue;
    const basis = item.when ? 'when' : 'due';
    if (!rule) {
      if (overlaps(span, from, to)) push({ item, span, projected: false, basis });
      continue;
    }
    const [first, last] = spanDays(span);
    const length = diffDays(first, last);
    // A finished repeating to-do only shows its own date, not future ones.
    for (const day of isDone(item) ? [first] : occurrencesBetween(rule, first, addDays(from, -length), to, 500)) {
      const s = day === first ? span : shiftSpan(span, diffDays(first, day));
      if (overlaps(s, from, to)) push({ item, span: s, projected: day !== first, basis });
    }
  }

  if (undated) {
    const created = await db.items
      .where('createdAt')
      .between(new Date(`${addDays(from, -1)}T00:00`).toISOString(), new Date(`${addDays(to, 2)}T00:00`).toISOString())
      .toArray();
    for (const item of created) {
      if (!live(item, includeArchived) || item.when || item.due) continue;
      const span: TimeSpan = { start: item.createdAt, end: null, allDay: false, tz: null };
      if (overlaps(span, from, to)) push({ item, span, projected: false, basis: 'created' });
    }
  }

  if (lines) {
    for (const l of await taskLines({ from, to })) {
      const date = l.ref.date!;
      const span: TimeSpan = date.length > 10 ? { start: date, end: null, allDay: false, tz: null } : { start: date, end: null, allDay: true, tz: null };
      const item: Item = { ...l.item, title: stripMentions(l.ref.text) || 'Checklist item', task: { done: l.ref.done, doneAt: null }, recurrence: null, reminders: [], due: null, when: span };
      out.push({ item, span, projected: false, basis: 'when', line: l.ref });
    }
  }

  return out.sort(comparePlaced);
}

/** All-day first, then by start time, then pinned, then title. */
export function comparePlaced(a: Placed, b: Placed): number {
  if (a.span.allDay !== b.span.allDay) return a.span.allDay ? -1 : 1;
  const t = spanStart(a.span).getTime() - spanStart(b.span).getTime();
  if (t) return t;
  if (a.item.pinned !== b.item.pinned) return a.item.pinned ? -1 : 1;
  return a.item.title.localeCompare(b.item.title);
}

export interface TaskLine {
  ref: TaskRef;
  item: Item;
  /** The line's date as a local day, if it has one. */
  day: LocalDate | null;
}

/** Checklist lines (with their live items), optionally only those dated within [from, to]. */
export async function taskLines(range?: { from: LocalDate; to: LocalDate }): Promise<TaskLine[]> {
  const refs = range
    ? await db.taskRefs.where('date').between(addDays(range.from, -1), `${addDays(range.to, 1)}￿`, true, true).toArray()
    : await db.taskRefs.toArray();
  const items = new Map((await db.items.bulkGet([...new Set(refs.map((r) => r.itemId))])).filter((i): i is Item => !!i).map((i) => [i.id, i]));
  const out: TaskLine[] = [];
  for (const ref of refs) {
    const item = items.get(ref.itemId);
    if (!item || item.deletedAt || item.archived) continue;
    const day = ref.date ? mentionDay(ref.date) : null;
    if (range && (!day || day < range.from || day > range.to)) continue;
    out.push({ ref, item, day });
  }
  return out.sort((a, b) => (a.day ?? '9999').localeCompare(b.day ?? '9999') || a.item.title.localeCompare(b.item.title) || Number(a.ref.anchor) - Number(b.ref.anchor));
}

/** Open to-do items (the item itself is the task), live only. */
export async function openTodoItems(): Promise<Item[]> {
  return (await db.items.toArray()).filter((i) => i.task && !i.task.done && !i.deletedAt && !i.archived);
}

/** Items overdue now: due in the past, or undone to-dos whose date has passed. */
export async function overdueItems(now = new Date()): Promise<Item[]> {
  const today = todayLocal(now);
  const hi = `${today}\uffff`;
  const [byDue, byWhen] = await Promise.all([
    db.items.where('due.start').below(hi).toArray(),
    db.items.where('when.start').below(hi).toArray(),
  ]);
  const map = new Map<string, Item>();
  for (const i of [...byDue, ...byWhen]) if (!i.deletedAt && isOverdue(i, now)) map.set(i.id, i);
  return [...map.values()].sort((a, b) => (itemSpan(a)!.start < itemSpan(b)!.start ? -1 : 1));
}

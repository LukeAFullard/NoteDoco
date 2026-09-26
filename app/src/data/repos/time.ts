import { db } from '../db';
import { touched } from '../meta';
import type { Id, Item, LocalDate, Reminder } from '../types';
import { duplicateItem, setBodyText } from './items';
import { nextOccurrence, parseRule } from '@/lib/recurrence';
import { diffDays, itemSpan, shiftSpan, spanDays, todayLocal } from '@/lib/time';
import { resetChecklist, toggleChecklistItem } from '@/lib/textInfo';
import { nowIso } from '@/lib/ids';

/** The text body of a note or sticky, or null for kinds without one. */
export async function getBodyText(id: Id): Promise<string | null> {
  const note = await db.noteBodies.get(id);
  if (note) return note.text;
  const sticky = await db.stickyBodies.get(id);
  return sticky ? sticky.text : null;
}

/** Ticks or unticks one checklist line (0-based among checklist lines) in an item's body. */
export async function toggleChecklistLine(itemId: Id, index: number): Promise<void> {
  const text = await getBodyText(itemId);
  if (text === null) return;
  await setBodyText(itemId, toggleChecklistItem(text, index));
}

const shiftReminders = (rs: Reminder[], days: number): Reminder[] =>
  rs.map((r) => {
    const at = new Date(r.at);
    at.setDate(at.getDate() + days);
    return { ...r, at: at.toISOString(), firedAt: null };
  });

export type CompleteResult =
  | { kind: 'done' }
  | { kind: 'next'; next: LocalDate }
  | { kind: 'copied'; copyId: Id; next: LocalDate | null };

/**
 * Marks an item done (TIME-12, TIME-15).
 *
 * - One-off items get a ticked checkbox.
 * - Repeating items move to their next date instead, with their checklist unticked and
 *   reminders moved along ("water the plants" is never finished for good).
 * - Repeating templates (mode copy) make a fresh copy for this date, which is what you work
 *   in, and the template moves to its next date.
 */
export async function completeItem(id: Id, now = new Date()): Promise<CompleteResult> {
  const it = await db.items.get(id);
  if (!it) throw new Error(`Item ${id} not found`);
  const rule = parseRule(it.recurrence);
  const span = itemSpan(it);
  if (!rule || !span) {
    await db.items.put(touched(it, { task: { done: true, doneAt: nowIso() } }));
    return { kind: 'done' };
  }
  const anchor = spanDays(span)[0];
  const today = todayLocal(now);
  const next = nextOccurrence(rule, anchor, anchor > today ? anchor : today);

  if (rule.mode === 'copy') {
    const copyId = await duplicateItem(id);
    const copyText = await getBodyText(copyId);
    if (copyText) await setBodyText(copyId, resetChecklist(copyText));
    const copy = (await db.items.get(copyId))!;
    await db.items.put(touched(copy, { recurrence: null, reminders: [], task: it.task && { done: false, doneAt: null } }));
    if (next) await advance(it, diffDays(anchor, next));
    return { kind: 'copied', copyId, next };
  }

  if (!next) {
    // The repeat has ended: this was the last one.
    await db.items.put(touched(it, { task: { done: true, doneAt: nowIso() } }));
    return { kind: 'done' };
  }
  const text = await getBodyText(id);
  if (text && resetChecklist(text) !== text) await setBodyText(id, resetChecklist(text));
  await advance((await db.items.get(id))!, diffDays(anchor, next));
  return { kind: 'next', next };
}

async function advance(it: Item, days: number) {
  await db.items.put(
    touched(it, {
      when: it.when && shiftSpan(it.when, days),
      due: it.due && shiftSpan(it.due, days),
      reminders: shiftReminders(it.reminders, days),
      task: it.task && { done: false, doneAt: null },
    }),
  );
}

/** Unticks a done item. */
export async function reopenItem(id: Id): Promise<void> {
  const it = await db.items.get(id);
  if (it) await db.items.put(touched(it, { task: it.task && { done: false, doneAt: null } }));
}

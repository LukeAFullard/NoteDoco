import type { Id, TaskRef } from './types';
import { checklistLines } from '@/lib/textInfo';
import { firstMention } from '@/lib/dateMentions';

/**
 * One TaskRef per checklist line, so Today and Tasks never parse bodies (ARCHITECTURE §4).
 * Pure (no database), so the schema upgrade in db.ts can use it too.
 */
export function taskRefsFor(itemId: Id, text: string): TaskRef[] {
  return checklistLines(text).map((l) => ({
    id: `${itemId}:${l.index}`,
    itemId,
    anchor: String(l.index),
    text: l.text,
    date: firstMention(l.text),
    done: l.done,
  }));
}

import { differenceInCalendarDays } from 'date-fns';
import type { Note, Recurrence } from '../types';

const RECURRENCE_DAYS: Record<Exclude<Recurrence, 'none'>, number> = { daily: 1, weekly: 7, monthly: 30 };

export const shouldResetRecurringChecklist = (
  note: { recurrence?: Recurrence; lastRecurredAt?: string | null; createdAt: string },
  now: Date = new Date()
): boolean => {
  const recurrence = note.recurrence ?? 'none';
  if (recurrence === 'none') return false;
  const since = note.lastRecurredAt ?? note.createdAt;
  return differenceInCalendarDays(now, new Date(since)) >= RECURRENCE_DAYS[recurrence];
};

export const resetChecklistItems = (markdown: string): string =>
  markdown.replace(/^(\s*)-\s\[(x|X)\]\s/gm, '$1- [ ] ');

export const duplicateNote = (source: Note): Note => {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    projectId: source.projectId,
    title: `Copy of ${source.title || 'Untitled note'}`,
    contentMarkdown: resetChecklistItems(source.contentMarkdown),
    goalDate: null,
    archived: false,
    recurrence: 'none',
    lastRecurredAt: null,
    createdAt: now,
    updatedAt: now,
  };
};

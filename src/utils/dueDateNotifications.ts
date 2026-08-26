import type { Note } from '../types';
import { getDueBucket } from './dueDate';

/**
 * Returns notes that are due today or overdue, excluding archived notes
 * and notes already notified in this session.
 */
export const getNewlyDueNotes = (
  notes: Note[],
  alreadyNotifiedIds: Set<string>,
  now: Date = new Date()
): Note[] => {
  return notes.filter((note) => {
    if (note.archived) return false;
    if (!note.goalDate) return false;
    if (alreadyNotifiedIds.has(note.id)) return false;

    const bucket = getDueBucket(note.goalDate, now);
    return bucket === 'today' || bucket === 'overdue';
  });
};

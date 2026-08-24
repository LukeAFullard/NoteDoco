import { addDays, isBefore, isSameDay, startOfDay, parseISO } from 'date-fns';

export type DueBucket = 'overdue' | 'today' | 'this-week' | 'later';

export const getDueBucket = (goalDate: string, now: Date = new Date()): DueBucket => {
  const today = startOfDay(now);
  const due = startOfDay(parseISO(goalDate));
  if (isBefore(due, today)) return 'overdue';
  if (isSameDay(due, today)) return 'today';
  if (isBefore(due, addDays(today, 7))) return 'this-week';
  return 'later';
};

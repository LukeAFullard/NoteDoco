import { addDays, addWeeks, format, isBefore, isSameDay, startOfDay, startOfWeek, parseISO } from 'date-fns';

export type DueBucket = 'overdue' | 'today' | 'this-week' | 'later';

export const getDueBucket = (goalDate: string, now: Date = new Date()): DueBucket => {
  const today = startOfDay(now);
  const due = startOfDay(parseISO(goalDate));
  if (isBefore(due, today)) return 'overdue';
  if (isSameDay(due, today)) return 'today';
  if (isBefore(due, addDays(today, 7))) return 'this-week';
  return 'later';
};

/**
 * Returns which timeline column a goal date falls into:
 * 0 = Overdue, 1 = This Week, 2-5 = the next 4 weeks, 6 = Later.
 */
export const getTimelineColumnIndex = (goalDate: string, now: Date = new Date()): number => {
  const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 });
  const due = startOfDay(parseISO(goalDate));
  if (isBefore(due, currentWeekStart)) return 0;
  for (let week = 0; week < 5; week++) {
    const weekStart = addWeeks(currentWeekStart, week);
    const weekEnd = addWeeks(currentWeekStart, week + 1);
    if (!isBefore(due, weekStart) && isBefore(due, weekEnd)) return week + 1;
  }
  return 6;
};

export interface TimelineColumn {
  label: string;
}

/** Builds the 7 column headers matching getTimelineColumnIndex's buckets. */
export const getTimelineColumns = (now: Date = new Date()): TimelineColumn[] => {
  const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 });
  const columns: TimelineColumn[] = [{ label: 'Overdue' }];
  for (let week = 0; week < 5; week++) {
    const weekStart = addWeeks(currentWeekStart, week);
    columns.push({ label: week === 0 ? 'This Week' : format(weekStart, 'MMM d') });
  }
  columns.push({ label: 'Later' });
  return columns;
};

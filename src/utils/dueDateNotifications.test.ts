import { describe, it, expect } from 'vitest';
import { format, addDays, subDays } from 'date-fns';
import { getNewlyDueNotes } from './dueDateNotifications';
import type { Note } from '../types';

describe('getNewlyDueNotes', () => {
  const now = new Date(2025, 4, 15, 10, 0, 0); // May 15, 2025
  const todayStr = format(now, 'yyyy-MM-dd');
  const overdueStr = format(subDays(now, 2), 'yyyy-MM-dd');
  const futureStr = format(addDays(now, 2), 'yyyy-MM-dd');

  const createNote = (id: string, goalDate: string | null, archived = false): Note => ({
    id,
    projectId: null,
    title: `Note ${id}`,
    contentMarkdown: '',
    goalDate,
    archived,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  it('includes notes due today', () => {
    const notes = [createNote('1', todayStr)];
    const result = getNewlyDueNotes(notes, new Set(), now);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('includes overdue notes', () => {
    const notes = [createNote('2', overdueStr)];
    const result = getNewlyDueNotes(notes, new Set(), now);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  it('excludes notes due in the future or with no goal date', () => {
    const notes = [createNote('3', futureStr), createNote('4', null)];
    const result = getNewlyDueNotes(notes, new Set(), now);
    expect(result).toHaveLength(0);
  });

  it('excludes notes already in alreadyNotifiedIds set even if due', () => {
    const notes = [createNote('5', todayStr), createNote('6', overdueStr)];
    const alreadyNotified = new Set(['5']);
    const result = getNewlyDueNotes(notes, alreadyNotified, now);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('6');
  });

  it('excludes archived notes even if due', () => {
    const notes = [createNote('7', todayStr, true), createNote('8', overdueStr, true)];
    const result = getNewlyDueNotes(notes, new Set(), now);
    expect(result).toHaveLength(0);
  });
});

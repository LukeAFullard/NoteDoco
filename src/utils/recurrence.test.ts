import { describe, it, expect } from 'vitest';
import { shouldResetRecurringChecklist, resetChecklistItems, duplicateNote } from './recurrence';
import type { Note } from '../types';

describe('shouldResetRecurringChecklist', () => {
  it('returns false for recurrence none', () => {
    const note = { recurrence: 'none' as const, createdAt: '2026-01-01T00:00:00.000Z' };
    const now = new Date('2026-01-10T00:00:00.000Z');
    expect(shouldResetRecurringChecklist(note, now)).toBe(false);
  });

  it('returns false for missing recurrence field', () => {
    const note = { createdAt: '2026-01-01T00:00:00.000Z' };
    const now = new Date('2026-01-10T00:00:00.000Z');
    expect(shouldResetRecurringChecklist(note, now)).toBe(false);
  });

  it('returns true once a daily interval has elapsed', () => {
    const note = { recurrence: 'daily' as const, createdAt: '2026-01-01T00:00:00.000Z' };
    const now = new Date('2026-01-02T00:00:00.000Z');
    expect(shouldResetRecurringChecklist(note, now)).toBe(true);
  });

  it('returns true once a weekly interval has elapsed using lastRecurredAt', () => {
    const note = {
      recurrence: 'weekly' as const,
      createdAt: '2026-01-01T00:00:00.000Z',
      lastRecurredAt: '2026-01-05T00:00:00.000Z',
    };
    const now = new Date('2026-01-12T00:00:00.000Z');
    expect(shouldResetRecurringChecklist(note, now)).toBe(true);
  });

  it('returns false if interval has not yet elapsed', () => {
    const note = { recurrence: 'daily' as const, createdAt: '2026-01-01T10:00:00.000Z' };
    const now = new Date('2026-01-01T15:00:00.000Z');
    expect(shouldResetRecurringChecklist(note, now)).toBe(false);
  });
});

describe('resetChecklistItems', () => {
  it('unchecks [x] and [X] lines and leaves other text untouched', () => {
    const input = `# Header
- [ ] Item 1
- [x] Item 2
  - [X] Sub item
Normal paragraph text`;
    const expected = `# Header
- [ ] Item 1
- [ ] Item 2
  - [ ] Sub item
Normal paragraph text`;
    expect(resetChecklistItems(input)).toBe(expected);
  });
});

describe('duplicateNote', () => {
  it('creates a copy with a new id, "Copy of <title>", reset checklist, goalDate null, and recurrence none', () => {
    const source: Note = {
      id: 'original-id',
      projectId: 'proj-1',
      title: 'Daily Routine',
      contentMarkdown: '- [x] Step 1\n- [ ] Step 2',
      goalDate: '2026-02-01',
      archived: false,
      recurrence: 'daily',
      lastRecurredAt: '2026-01-01T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    const copy = duplicateNote(source);
    expect(copy.id).not.toBe(source.id);
    expect(copy.projectId).toBe('proj-1');
    expect(copy.title).toBe('Copy of Daily Routine');
    expect(copy.contentMarkdown).toBe('- [ ] Step 1\n- [ ] Step 2');
    expect(copy.goalDate).toBeNull();
    expect(copy.archived).toBe(false);
    expect(copy.recurrence).toBe('none');
    expect(copy.lastRecurredAt).toBeNull();
  });

  it('handles untitled source note title', () => {
    const source: Note = {
      id: 'original-id',
      projectId: null,
      title: '',
      contentMarkdown: '- [x] Task',
      goalDate: null,
      archived: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    const copy = duplicateNote(source);
    expect(copy.title).toBe('Copy of Untitled note');
  });
});

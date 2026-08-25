import { describe, it, expect } from 'vitest';
import { computeProjectReportSummary, buildCloseOutReportDoc } from './closeOutReport';
import type { Note } from '../types';

const makeNote = (overrides: Partial<Note> = {}): Note => {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    projectId: 'project-1',
    title: 'Test note',
    contentMarkdown: '',
    goalDate: null,
    archived: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
};

describe('computeProjectReportSummary', () => {
  it('returns zeros for an empty note list', () => {
    expect(computeProjectReportSummary([])).toEqual({ totalNotes: 0, totalChecklistItems: 0, checkedChecklistItems: 0 });
  });

  it('aggregates checklist totals across notes, ignoring notes with no checklist', () => {
    const notes = [
      makeNote({ contentMarkdown: '- [ ] a\n- [x] b' }),
      makeNote({ contentMarkdown: 'just prose, no checklist' }),
      makeNote({ contentMarkdown: '- [x] c' }),
    ];
    expect(computeProjectReportSummary(notes)).toEqual({ totalNotes: 3, totalChecklistItems: 3, checkedChecklistItems: 2 });
  });
});

describe('buildCloseOutReportDoc', () => {
  it('builds a valid PDF for an empty note list without throwing', () => {
    expect(() => buildCloseOutReportDoc('Empty Project', [])).not.toThrow();
  });

  it('builds a valid PDF for a populated note list', () => {
    const notes = [makeNote({ title: 'Task list', contentMarkdown: '- [ ] one\n- [x] two', goalDate: '2026-09-01' })];
    const doc = buildCloseOutReportDoc('Test Project', notes);
    const output = doc.output('datauristring');
    expect(output.startsWith('data:application/pdf')).toBe(true);
  });
});

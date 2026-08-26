import { describe, it, expect } from 'vitest';
import { extractTags, getAllTags, searchNotes, getMatchSnippet } from './search';
import type { Note } from '../types';

const makeNote = (overrides: Partial<Note> = {}): Note => {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    projectId: null,
    title: 'Untitled',
    contentMarkdown: '',
    goalDate: null,
    archived: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
};

describe('extractTags', () => {
  it('extracts lowercase, de-duplicated hashtags', () => {
    expect(extractTags('Talk about #Recipe and #recipe again, also #travel')).toEqual(['recipe', 'travel']);
  });

  it('does not match a markdown heading', () => {
    expect(extractTags('# My Heading\nSome text')).toEqual([]);
  });

  it('returns an empty array when there are no tags', () => {
    expect(extractTags('just plain text')).toEqual([]);
  });
});

describe('getAllTags', () => {
  it('counts tag occurrences across notes, sorted by frequency then name', () => {
    const notes = [
      makeNote({ contentMarkdown: '#work #urgent' }),
      makeNote({ contentMarkdown: '#work' }),
      makeNote({ contentMarkdown: '#personal' }),
    ];
    expect(getAllTags(notes)).toEqual([
      { tag: 'work', count: 2 },
      { tag: 'personal', count: 1 },
      { tag: 'urgent', count: 1 },
    ]);
  });
});

describe('searchNotes', () => {
  const notes = [
    makeNote({ title: 'Grocery list', contentMarkdown: '- [ ] milk\n#errands' }),
    makeNote({ title: 'Project plan', contentMarkdown: 'Discuss #work priorities' }),
  ];

  it('returns an empty array for a blank query', () => {
    expect(searchNotes(notes, '  ')).toEqual([]);
  });

  it('matches by title or content substring, case-insensitively', () => {
    expect(searchNotes(notes, 'GROCERY')).toHaveLength(1);
    expect(searchNotes(notes, 'priorities')).toHaveLength(1);
  });

  it('filters by tag when the query starts with #', () => {
    const results = searchNotes(notes, '#errands');
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Grocery list');
  });

  it('returns nothing for a tag that does not exist', () => {
    expect(searchNotes(notes, '#nonexistent')).toEqual([]);
  });
});

describe('getMatchSnippet', () => {
  it('trims a snippet around the matched text with ellipses', () => {
    const content = 'a'.repeat(60) + 'NEEDLE' + 'b'.repeat(60);
    const snippet = getMatchSnippet(content, 'needle', 10);
    expect(snippet).toContain('NEEDLE');
    expect(snippet.startsWith('…')).toBe(true);
    expect(snippet.endsWith('…')).toBe(true);
  });
});

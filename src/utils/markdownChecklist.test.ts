import { describe, it, expect } from 'vitest';
import { splitIntoBlocks, toggleChecklistLine, parseChecklistLine, getChecklistProgress } from './markdownChecklist';

describe('parseChecklistLine', () => {
  it('parses an unchecked item', () => {
    expect(parseChecklistLine('- [ ] buy milk')).toEqual({ indent: '', checked: false, text: 'buy milk' });
  });

  it('parses a checked item case-insensitively', () => {
    expect(parseChecklistLine('- [X] done')?.checked).toBe(true);
  });

  it('returns null for a non-checklist line', () => {
    expect(parseChecklistLine('just a paragraph')).toBeNull();
  });
});

describe('splitIntoBlocks', () => {
  it('groups consecutive checklist lines into one block', () => {
    const md = 'Heading\n\n- [ ] one\n- [x] two\n\nMore text';
    const blocks = splitIntoBlocks(md);
    const checklistBlock = blocks.find((b) => b.type === 'checklist');
    expect(checklistBlock).toBeDefined();
    expect(checklistBlock!.lines).toEqual(['- [ ] one', '- [x] two']);
    expect(checklistBlock!.startLine).toBe(2);
  });
});

describe('toggleChecklistLine', () => {
  it('flips unchecked to checked', () => {
    expect(toggleChecklistLine('- [ ] one\n- [ ] two', 0)).toBe('- [x] one\n- [ ] two');
  });

  it('flips checked to unchecked', () => {
    expect(toggleChecklistLine('- [x] one', 0)).toBe('- [ ] one');
  });

  it('is a no-op on a non-checklist line', () => {
    expect(toggleChecklistLine('plain text', 0)).toBe('plain text');
  });
});

describe('getChecklistProgress', () => {
  it('returns null when there are no checklist items', () => {
    expect(getChecklistProgress('just a paragraph, no items')).toBeNull();
  });

  it('counts total and checked items', () => {
    const md = '- [ ] one\n- [x] two\n- [x] three';
    expect(getChecklistProgress(md)).toEqual({ total: 3, checked: 2 });
  });
});

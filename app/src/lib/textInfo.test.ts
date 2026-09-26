import { analyseText, extractTags, renameTagInText, stripMarkdownLine, toggleChecklistItem } from './textInfo';

describe('analyseText', () => {
  it('derives title, preview, words and checklist progress from Markdown', () => {
    const info = analyseText('# Groceries\n\n- [ ] **milk**\n- [x] eggs\n- [X] [bread](https://x.y)\n\nFor #weekend and #Home');
    expect(info.title).toBe('Groceries');
    expect(info.preview).toBe('milk eggs bread For #weekend and #Home');
    expect(info).toMatchObject({ checklistTotal: 3, checklistDone: 2, tags: ['home', 'weekend'] });
    expect(info.words).toBe(8);
  });

  it('ignores code blocks for checklists and tags', () => {
    const info = analyseText('Title\n```\n- [ ] not a task #nottag\n```\nuse `#nope` here #yes');
    expect(info).toMatchObject({ checklistTotal: 0, tags: ['yes'] });
  });

  it('leaves plain text as written', () => {
    expect(analyseText('**not bold**\nline two', 'plain')).toMatchObject({ title: '**not bold**', preview: 'line two' });
  });

  it('handles empty text', () => {
    expect(analyseText('')).toEqual({ title: '', preview: '', words: 0, checklistTotal: 0, checklistDone: 0, tags: [] });
  });
});

describe('tags', () => {
  it('finds unicode tags, ignores headings and numbers, trims trailing punctuation', () => {
    expect(extractTags('## Heading\n#café-plans #2026 #work/client- (#idea)')).toEqual(['café-plans', 'idea', 'work/client']);
  });
});

describe('stripMarkdownLine', () => {
  it('keeps readable text', () => {
    expect(stripMarkdownLine('> - [ ] See [[Launch plan]] and ![img](a.png) `code`')).toBe('See Launch plan and code');
    expect(stripMarkdownLine('| --- | :--: |')).toBe('');
  });
});

describe('toggleChecklistItem', () => {
  it('toggles only the chosen checklist line', () => {
    const md = 'Intro\n- [ ] a\n- [x] b\n  - [ ] c';
    expect(toggleChecklistItem(md, 0)).toBe('Intro\n- [x] a\n- [x] b\n  - [ ] c');
    expect(toggleChecklistItem(md, 1)).toBe('Intro\n- [ ] a\n- [ ] b\n  - [ ] c');
    expect(toggleChecklistItem(md, 2)).toBe('Intro\n- [ ] a\n- [x] b\n  - [x] c');
  });
});

describe('renameTagInText', () => {
  it('renames whole tags only, outside code, any case', () => {
    const md = 'Plan #Work and #workshop, (#work)\n`#work` stays\n```\n#work stays\n```\n#work/sub stays';
    expect(renameTagInText(md, 'work', 'client')).toBe('Plan #client and #workshop, (#client)\n`#work` stays\n```\n#work stays\n```\n#work/sub stays');
  });
});

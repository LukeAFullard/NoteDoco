import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { SearchReplace, searchKey } from './searchReplace';

const make = (md: string) => new Editor({ extensions: [StarterKit, Markdown, SearchReplace], content: md, contentType: 'markdown' });

it('finds matches case-insensitively across paragraphs and formatting', () => {
  const e = make('The **cat** sat.\n\nA Cat nap. cat!');
  e.commands.setSearch('cat');
  expect(searchKey.getState(e.state)!.matches).toHaveLength(3);
  e.destroy();
});

it('replaces the current match, then all', () => {
  const e = make('one fish two fish red fish');
  e.commands.setSearch('fish');
  e.commands.findNext();
  e.commands.replaceCurrent('cat');
  expect(e.getMarkdown()).toBe('one fish two cat red fish');
  e.commands.replaceAll('dog');
  expect(e.getMarkdown()).toBe('one dog two cat red dog');
  e.destroy();
});

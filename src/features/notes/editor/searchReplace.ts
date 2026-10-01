import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export interface SearchState {
  query: string;
  matches: Array<{ from: number; to: number }>;
  index: number;
}

export const searchKey = new PluginKey<SearchState>('search');

/** All case-insensitive matches of `query` in text blocks (matches don't span blocks). */
export function findMatches(state: EditorState, query: string): Array<{ from: number; to: number }> {
  const out: Array<{ from: number; to: number }> = [];
  if (!query) return out;
  const needle = query.toLocaleLowerCase();
  state.doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    // Map each character of the block's text back to a document position.
    let text = '';
    const positions: number[] = [];
    node.forEach((child, offset) => {
      if (child.isText) {
        for (let i = 0; i < child.text!.length; i++) positions.push(pos + 1 + offset + i);
        text += child.text;
      } else {
        positions.push(-1);
        text += '￼';
      }
    });
    const hay = text.toLocaleLowerCase();
    let i = hay.indexOf(needle);
    while (i >= 0) {
      const from = positions[i]!;
      const to = positions[i + needle.length - 1]! + 1;
      if (from >= 0 && to > from) out.push({ from, to });
      i = hay.indexOf(needle, i + Math.max(1, needle.length));
    }
    return false;
  });
  return out;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    search: {
      setSearch: (query: string) => ReturnType;
      findNext: (step?: 1 | -1) => ReturnType;
      replaceCurrent: (replacement: string) => ReturnType;
      replaceAll: (replacement: string) => ReturnType;
    };
  }
}

/** Find and replace within a note (NOTE-13), with highlighted matches. */
export const SearchReplace = Extension.create({
  name: 'searchReplace',

  addCommands() {
    const meta = (tr: import('@tiptap/pm/state').Transaction, s: Partial<SearchState>) => tr.setMeta(searchKey, s);
    return {
      setSearch:
        (query) =>
        ({ tr, dispatch }) => {
          if (dispatch) meta(tr, { query, index: 0 });
          return true;
        },
      findNext:
        (step = 1) =>
        ({ state, tr, dispatch }) => {
          const s = searchKey.getState(state);
          if (!s?.matches.length) return false;
          const index = (s.index + step + s.matches.length) % s.matches.length;
          if (dispatch) meta(tr, { index });
          return true;
        },
      replaceCurrent:
        (replacement) =>
        ({ state, tr, dispatch }) => {
          const s = searchKey.getState(state);
          const m = s?.matches[s.index];
          if (!m) return false;
          if (dispatch) tr.insertText(replacement, m.from, m.to);
          return true;
        },
      replaceAll:
        (replacement) =>
        ({ state, tr, dispatch }) => {
          const s = searchKey.getState(state);
          if (!s?.matches.length) return false;
          if (dispatch) for (const m of [...s.matches].reverse()) tr.insertText(replacement, m.from, m.to);
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<SearchState>({
        key: searchKey,
        state: {
          init: () => ({ query: '', matches: [], index: 0 }),
          apply(tr, prev, _old, next) {
            const m = tr.getMeta(searchKey) as Partial<SearchState> | undefined;
            const query = m?.query ?? prev.query;
            if (!m && !tr.docChanged) return prev;
            const matches = findMatches(next, query);
            const index = Math.min(m?.index ?? prev.index, Math.max(0, matches.length - 1));
            return { query, matches, index };
          },
        },
        props: {
          decorations(state) {
            const s = searchKey.getState(state);
            if (!s?.matches.length) return DecorationSet.empty;
            return DecorationSet.create(
              state.doc,
              s.matches.map((m, i) => Decoration.inline(m.from, m.to, { class: i === s.index ? 'search-match current' : 'search-match' })),
            );
          },
        },
      }),
    ];
  },
});

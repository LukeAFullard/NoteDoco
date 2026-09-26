import { InputRule, Node, mergeAttributes } from '@tiptap/core';

/**
 * `[[Wikilink]]` inline node. Without it, @tiptap/markdown stores typed links escaped as
 * `\[\[…\]\]` (spike P0.8). Link features (autocomplete, backlinks, rename-rewrite) come in
 * Phase 5 (NOTE-10); for now the node keeps the syntax intact and typing `[[name]]` creates it.
 */
export const WikiLink = Node.create({
  name: 'wikiLink',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return { target: { default: '' } };
  },

  parseHTML() {
    return [{ tag: 'a[data-wikilink]', getAttrs: (el) => ({ target: (el as HTMLElement).dataset.wikilink }) }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['a', mergeAttributes(HTMLAttributes, { 'data-wikilink': node.attrs.target, class: 'wikilink' }), node.attrs.target];
  },

  renderText({ node }) {
    return `[[${node.attrs.target}]]`;
  },

  addInputRules() {
    return [
      new InputRule({
        find: /\[\[([^\]\n]+)\]\]$/,
        handler: ({ state, range, match }) => {
          state.tr.replaceWith(range.from, range.to, this.type.create({ target: match[1]!.trim() }));
        },
      }),
    ];
  },

  markdownTokenizer: {
    name: 'wikiLink',
    level: 'inline',
    start: (src: string) => src.indexOf('[['),
    tokenize(src: string) {
      const m = /^\[\[([^\]\n]+)\]\]/.exec(src);
      if (!m) return undefined;
      return { type: 'wikiLink', raw: m[0], target: m[1] };
    },
  },

  parseMarkdown(token) {
    return { type: 'wikiLink', attrs: { target: (token as { target?: string }).target ?? '' } };
  },

  renderMarkdown(node) {
    return `[[${node.attrs?.target ?? ''}]]`;
  },
});

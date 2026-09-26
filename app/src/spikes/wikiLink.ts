import { Node, mergeAttributes } from '@tiptap/core';

/**
 * Spike: a minimal `[[Wikilink]]` inline node, proving our own syntax can round-trip through
 * @tiptap/markdown instead of being escaped to `\[\[…\]\]`. The real feature (autocomplete,
 * backlinks, rename-rewrite) is NOTE-10 in Phase 5; the node itself should land in Phase 1 so
 * typed `[[links]]` are stored correctly from day one.
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
    return node.attrs.target;
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

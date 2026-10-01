import { Extension, InputRule } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';
import { MENTION, shorthandDate } from '@/lib/dateMentions';
import { formatDay, todayLocal } from '@/lib/time';

/**
 * Date chips (NOTE-9). Typing `@fri` then a space or punctuation becomes `@2026-10-02`, which
 * stays plain text in the Markdown; a decoration shows it as a chip with the friendly date.
 * A checklist line with a chip shows on Today, the Tasks view and the timeline.
 */

function decorations(doc: PMNode): DecorationSet {
  const decos: Decoration[] = [];
  const today = todayLocal();
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text?.includes('@')) return;
    if (node.marks.some((m) => m.type.name === 'code')) return;
    for (const m of node.text.matchAll(MENTION)) {
      const from = pos + m.index + m[1]!.length;
      const to = pos + m.index + m[0].length;
      const day = m[2]!;
      decos.push(
        Decoration.inline(from, to, {
          class: day < today ? 'date-chip date-chip-past' : 'date-chip',
          title: `${formatDay(day)}${m[3] ? ` ${m[3]}` : ''}`,
        }),
      );
    }
  });
  return DecorationSet.create(doc, decos);
}

const key = new PluginKey<DecorationSet>('dateChips');

export const DateChip = Extension.create({
  name: 'dateChip',

  addInputRules() {
    return [
      new InputRule({
        find: /(?:^|[\s(])@([A-Za-z][A-Za-z-]*)([\s.,;:!?)])$/,
        handler: ({ state, range, match }) => {
          const day = shorthandDate(match[1]!);
          if (!day) return null;
          // The match includes the character just typed (a space or punctuation), which isn't
          // in the document yet: the range covers everything before it.
          const start = range.from + match[0].indexOf('@');
          state.tr.insertText(`@${day}${match[2]}`, start, range.to);
        },
      }),
    ];
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key,
        state: {
          init: (_, { doc }) => decorations(doc),
          apply: (tr, old) => (tr.docChanged ? decorations(tr.doc) : old),
        },
        props: { decorations: (state) => key.getState(state) },
      }),
    ];
  },
});

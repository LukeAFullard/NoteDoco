import { Extension } from '@tiptap/core';
import { ReactRenderer } from '@tiptap/react';
import Suggestion, { type SuggestionProps } from '@tiptap/suggestion';
import { PluginKey } from '@tiptap/pm/state';
import { filterCommands, type SlashCommand } from './slashCommands';
import { SlashMenu, type SlashMenuHandle, type SlashMenuProps } from './SlashMenu';

type Props = SuggestionProps<SlashCommand, SlashCommand>;

/** Type "/" to insert headings, checklists, tables, images, dates (NOTE-4). */
export const SlashExtension = Extension.create({
  name: 'slashCommand',
  addProseMirrorPlugins() {
    return [
      Suggestion<SlashCommand, SlashCommand>({
        editor: this.editor,
        pluginKey: new PluginKey('slashCommand'),
        char: '/',
        items: ({ query }) => filterCommands(query),
        command: ({ editor, range, props }) => props.run(editor, range),
        render: () => {
          let renderer: ReactRenderer<SlashMenuHandle, SlashMenuProps> | null = null;
          const toProps = (p: Props): SlashMenuProps => ({ items: p.items, command: p.command, rect: p.clientRect?.() ?? null });
          return {
            onStart: (p) => {
              renderer = new ReactRenderer(SlashMenu, { editor: p.editor, props: toProps(p) });
              document.body.appendChild(renderer.element);
            },
            onUpdate: (p) => renderer?.updateProps(toProps(p)),
            onKeyDown: ({ event }) => {
              if (event.key === 'Escape') {
                renderer?.destroy();
                renderer?.element.remove();
                renderer = null;
                return true;
              }
              return renderer?.ref?.onKeyDown(event) ?? false;
            },
            onExit: () => {
              renderer?.destroy();
              renderer?.element.remove();
              renderer = null;
            },
          };
        },
      }),
    ];
  },
});

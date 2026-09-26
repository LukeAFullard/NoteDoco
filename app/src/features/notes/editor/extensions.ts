import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { TableKit } from '@tiptap/extension-table';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { Placeholder } from '@tiptap/extensions';
import { createLowlight } from 'lowlight';
import bash from 'highlight.js/lib/languages/bash';
import css from 'highlight.js/lib/languages/css';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import markdown from 'highlight.js/lib/languages/markdown';
import python from 'highlight.js/lib/languages/python';
import sql from 'highlight.js/lib/languages/sql';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';
import { WikiLink } from './wikiLink';
import { AttachmentImage } from './attachmentImage';
import { SearchReplace } from './searchReplace';
import { SlashExtension } from './slashExtension';

// A handful of common languages keeps the editor download small (the full set is ~5× larger).
const lowlight = createLowlight({ bash, css, javascript, json, markdown, python, sql, typescript, xml, yaml });
lowlight.registerAlias({ javascript: ['js', 'jsx'], typescript: ['ts', 'tsx'], xml: ['html', 'svg'], bash: ['sh', 'shell', 'zsh'], yaml: ['yml'], markdown: ['md'] });

/** Everything the note editor loads. Add a round-trip case (src/spikes) for any new node. */
export function noteExtensions() {
  return [
    StarterKit.configure({
      codeBlock: false,
      heading: { levels: [1, 2, 3] },
      link: {
        openOnClick: false,
        autolink: true,
        isAllowedUri: (url, ctx) => url.startsWith('ndoco:') || !!ctx.defaultValidate(url),
      },
    }),
    CodeBlockLowlight.configure({ lowlight, defaultLanguage: null }),
    TaskList,
    TaskItem.configure({ nested: true }),
    TableKit.configure({ table: { resizable: false } }),
    AttachmentImage,
    WikiLink,
    SearchReplace,
    SlashExtension,
    Placeholder.configure({
      placeholder: ({ node, pos }) => (pos === 0 && node.type.name === 'heading' ? 'Title' : pos === 0 ? 'Start with a title… (type / for blocks)' : 'Type / for headings, checklists, tables…'),
    }),
    Markdown,
  ];
}

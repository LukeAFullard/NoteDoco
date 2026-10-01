import type { Editor, Range } from '@tiptap/core';

export interface SlashCommand {
  title: string;
  hint: string;
  keywords: string[];
  run: (editor: Editor, range: Range) => void;
}

const today = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** Asks the note editor to open the image picker (the editor owns the file input). */
export const INSERT_IMAGE_EVENT = 'notedoco:insert-image';

/** Asks the note editor to add a sketch block (it knows which note to attach it to). */
export const INSERT_SKETCH_EVENT = 'notedoco:insert-sketch';

export const SLASH_COMMANDS: SlashCommand[] = [
  { title: 'Heading 1', hint: '#', keywords: ['h1', 'title'], run: (e, r) => e.chain().focus().deleteRange(r).setNode('heading', { level: 1 }).run() },
  { title: 'Heading 2', hint: '##', keywords: ['h2', 'subtitle'], run: (e, r) => e.chain().focus().deleteRange(r).setNode('heading', { level: 2 }).run() },
  { title: 'Heading 3', hint: '###', keywords: ['h3'], run: (e, r) => e.chain().focus().deleteRange(r).setNode('heading', { level: 3 }).run() },
  { title: 'Checklist', hint: '[ ]', keywords: ['todo', 'task', 'checkbox'], run: (e, r) => e.chain().focus().deleteRange(r).toggleTaskList().run() },
  { title: 'Bullet list', hint: '-', keywords: ['ul', 'unordered'], run: (e, r) => e.chain().focus().deleteRange(r).toggleBulletList().run() },
  { title: 'Numbered list', hint: '1.', keywords: ['ol', 'ordered'], run: (e, r) => e.chain().focus().deleteRange(r).toggleOrderedList().run() },
  { title: 'Quote', hint: '>', keywords: ['blockquote', 'callout'], run: (e, r) => e.chain().focus().deleteRange(r).toggleBlockquote().run() },
  { title: 'Code block', hint: '```', keywords: ['code', 'snippet'], run: (e, r) => e.chain().focus().deleteRange(r).toggleCodeBlock().run() },
  {
    title: 'Table',
    hint: '3×3',
    keywords: ['grid'],
    run: (e, r) => e.chain().focus().deleteRange(r).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  { title: 'Divider', hint: '---', keywords: ['rule', 'hr', 'line'], run: (e, r) => e.chain().focus().deleteRange(r).setHorizontalRule().run() },
  {
    title: 'Image',
    hint: 'from files',
    keywords: ['picture', 'photo'],
    run: (e, r) => {
      e.chain().focus().deleteRange(r).run();
      window.dispatchEvent(new CustomEvent(INSERT_IMAGE_EVENT));
    },
  },
  {
    title: 'Sketch',
    hint: 'draw with a pen',
    keywords: ['draw', 'ink', 'handwriting', 'pen', 'diagram'],
    run: (e, r) => {
      e.chain().focus().deleteRange(r).run();
      window.dispatchEvent(new CustomEvent(INSERT_SKETCH_EVENT, { detail: { editor: e } }));
    },
  },
  { title: 'Today’s date', hint: '@date', keywords: ['date', 'today', 'now'], run: (e, r) => e.chain().focus().deleteRange(r).insertContent(`@${today()} `).run() },
];

export function filterCommands(query: string): SlashCommand[] {
  const q = query.toLowerCase().trim();
  if (!q) return SLASH_COMMANDS;
  return SLASH_COMMANDS.filter((c) => c.title.toLowerCase().includes(q) || c.keywords.some((k) => k.startsWith(q)));
}

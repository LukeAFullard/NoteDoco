import type { Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import {
  Bold, Code, Heading1, Heading2, Heading3, ImagePlus, Italic, Link2, List, ListChecks, ListOrdered, Quote, Redo2, SquareCode, Strikethrough, Table, Undo2,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/design/cn';

function Tool({ label, active, onPress, children, disabled }: { label: string; active?: boolean; onPress: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      // Keep focus (and the selection) in the editor.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onPress}
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-panel text-text disabled:opacity-30',
        active ? 'bg-accent-soft text-accent' : 'hover:bg-surface-2',
      )}
    >
      {children}
    </button>
  );
}

const Sep = () => <span className="mx-1 h-5 w-px shrink-0 bg-border" />;

export function Toolbar({ editor, onImage }: { editor: Editor; onImage: () => void }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      strike: e.isActive('strike'),
      code: e.isActive('code'),
      h1: e.isActive('heading', { level: 1 }),
      h2: e.isActive('heading', { level: 2 }),
      h3: e.isActive('heading', { level: 3 }),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      task: e.isActive('taskList'),
      quote: e.isActive('blockquote'),
      codeBlock: e.isActive('codeBlock'),
      link: e.isActive('link'),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const c = () => editor.chain().focus();
  const setLink = () => {
    if (s.link) return void c().unsetLink().run();
    const url = window.prompt('Link address', 'https://');
    if (url) c().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <div role="toolbar" aria-label="Formatting" className="flex items-center gap-0.5 overflow-x-auto px-2 py-1 [scrollbar-width:none]">
      <Tool label="Undo" onPress={() => c().undo().run()} disabled={!s.canUndo}><Undo2 size={17} /></Tool>
      <Tool label="Redo" onPress={() => c().redo().run()} disabled={!s.canRedo}><Redo2 size={17} /></Tool>
      <Sep />
      <Tool label="Heading 1" active={s.h1} onPress={() => c().toggleHeading({ level: 1 }).run()}><Heading1 size={17} /></Tool>
      <Tool label="Heading 2" active={s.h2} onPress={() => c().toggleHeading({ level: 2 }).run()}><Heading2 size={17} /></Tool>
      <Tool label="Heading 3" active={s.h3} onPress={() => c().toggleHeading({ level: 3 }).run()}><Heading3 size={17} /></Tool>
      <Sep />
      <Tool label="Bold" active={s.bold} onPress={() => c().toggleBold().run()}><Bold size={17} /></Tool>
      <Tool label="Italic" active={s.italic} onPress={() => c().toggleItalic().run()}><Italic size={17} /></Tool>
      <Tool label="Strikethrough" active={s.strike} onPress={() => c().toggleStrike().run()}><Strikethrough size={17} /></Tool>
      <Tool label="Inline code" active={s.code} onPress={() => c().toggleCode().run()}><Code size={17} /></Tool>
      <Tool label="Link" active={s.link} onPress={setLink}><Link2 size={17} /></Tool>
      <Sep />
      <Tool label="Checklist" active={s.task} onPress={() => c().toggleTaskList().run()}><ListChecks size={17} /></Tool>
      <Tool label="Bullet list" active={s.bullet} onPress={() => c().toggleBulletList().run()}><List size={17} /></Tool>
      <Tool label="Numbered list" active={s.ordered} onPress={() => c().toggleOrderedList().run()}><ListOrdered size={17} /></Tool>
      <Tool label="Quote" active={s.quote} onPress={() => c().toggleBlockquote().run()}><Quote size={17} /></Tool>
      <Tool label="Code block" active={s.codeBlock} onPress={() => c().toggleCodeBlock().run()}><SquareCode size={17} /></Tool>
      <Tool label="Table" onPress={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><Table size={17} /></Tool>
      <Tool label="Image" onPress={onImage}><ImagePlus size={17} /></Tool>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { searchKey } from './searchReplace';
import { Button } from '@/design/Button';

export function FindBar({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const { count, index } = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const s = searchKey.getState(e.state);
      return { count: s?.matches.length ?? 0, index: s?.index ?? 0 };
    },
  });

  useEffect(() => input.current?.focus(), []);
  useEffect(() => {
    editor.commands.setSearch(query);
  }, [editor, query]);
  useEffect(() => () => void editor.commands.setSearch(''), [editor]);

  const field = 'h-8 min-w-0 flex-1 rounded-panel border border-border bg-bg px-2 text-sm outline-none focus:border-accent';
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2" role="search">
      <input
        ref={input}
        aria-label="Find in note"
        placeholder="Find"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') editor.commands.findNext(e.shiftKey ? -1 : 1);
          if (e.key === 'Escape') onClose();
        }}
        className={field}
      />
      <span className="w-14 text-center font-mono text-xs text-muted" aria-live="polite">
        {query ? (count ? `${index + 1}/${count}` : '0/0') : ''}
      </span>
      <button type="button" aria-label="Previous match" className="text-muted hover:text-text" onClick={() => editor.commands.findNext(-1)}>
        <ChevronUp size={18} />
      </button>
      <button type="button" aria-label="Next match" className="text-muted hover:text-text" onClick={() => editor.commands.findNext(1)}>
        <ChevronDown size={18} />
      </button>
      <input aria-label="Replace with" placeholder="Replace with" value={replacement} onChange={(e) => setReplacement(e.target.value)} className={field} />
      <Button size="sm" isDisabled={!count} onPress={() => editor.commands.replaceCurrent(replacement)}>
        Replace
      </Button>
      <Button size="sm" isDisabled={!count} onPress={() => editor.commands.replaceAll(replacement)}>
        All
      </Button>
      <button type="button" aria-label="Close find" className="text-muted hover:text-text" onClick={onClose}>
        <X size={18} />
      </button>
    </div>
  );
}

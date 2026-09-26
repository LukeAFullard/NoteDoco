import { forwardRef, useImperativeHandle, useState } from 'react';
import { cn } from '@/design/cn';
import type { SlashCommand } from './slashCommands';

export interface SlashMenuHandle {
  onKeyDown: (e: KeyboardEvent) => boolean;
}

export interface SlashMenuProps {
  items: SlashCommand[];
  command: (c: SlashCommand) => void;
  rect: DOMRect | null;
}

/** The "/" command popup. Arrow keys move, Enter or Tab picks, Escape closes. */
export const SlashMenu = forwardRef<SlashMenuHandle, SlashMenuProps>(function SlashMenu({ items, command, rect }, ref) {
  // The highlighted row resets to the top whenever the filtered list changes.
  const [sel, setSel] = useState({ items, index: 0 });
  const index = sel.items === items ? sel.index : 0;
  const setIndex = (f: (i: number) => number) => setSel({ items, index: f(index) });

  useImperativeHandle(ref, () => ({
    onKeyDown: (e) => {
      if (!items.length) return false;
      if (e.key === 'ArrowDown') {
        setIndex((i) => (i + 1) % items.length);
        return true;
      }
      if (e.key === 'ArrowUp') {
        setIndex((i) => (i - 1 + items.length) % items.length);
        return true;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        command(items[index]!);
        return true;
      }
      return false;
    },
  }));

  if (!rect || !items.length) return null;
  const below = rect.bottom + 280 < window.innerHeight;
  return (
    <div
      role="listbox"
      aria-label="Insert"
      className="fixed z-50 max-h-72 w-60 overflow-y-auto rounded-panel border border-border bg-surface p-1 shadow-xl"
      style={{ left: Math.min(rect.left, window.innerWidth - 250), ...(below ? { top: rect.bottom + 6 } : { bottom: window.innerHeight - rect.top + 6 }) }}
    >
      {items.map((c, i) => (
        <button
          key={c.title}
          type="button"
          role="option"
          aria-selected={i === index}
          onMouseEnter={() => setIndex(() => i)}
          onMouseDown={(e) => {
            e.preventDefault();
            command(c);
          }}
          className={cn('flex w-full items-center justify-between rounded px-2.5 py-1.5 text-left text-sm', i === index && 'bg-accent-soft')}
        >
          {c.title}
          <span className="font-mono text-xs text-muted">{c.hint}</span>
        </button>
      ))}
    </div>
  );
});

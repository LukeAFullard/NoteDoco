import { useLiveQuery } from 'dexie-react-hooks';
import { Check, Pin } from 'lucide-react';
import { db } from '@/data/db';
import { setBodyText } from '@/data/repos/items';
import type { Item } from '@/data/types';
import { cn } from '@/design/cn';
import { toggleChecklistItem } from '@/lib/textInfo';
import { COLOUR_LABELS } from '@/lib/palette';
import { usePrefs } from '@/app/prefs';
import { STICKY_SIZES, tiltFor } from './stickyStyle';

const CHECK = /^\s*[-*+]\s+\[( |x|X)\]\s+(.*)$/;

/** Renders sticky text: checklist lines become tickable boxes, other lines plain text. */
export function StickyText({ itemId, text, interactive = true }: { itemId: string; text: string; interactive?: boolean }) {
  let checklistIndex = -1;
  return (
    <div className="space-y-1 break-words whitespace-pre-wrap">
      {text.split('\n').map((line, i) => {
        const m = CHECK.exec(line);
        if (!m) return <p key={i}>{line || ' '}</p>;
        const idx = ++checklistIndex;
        const done = m[1] !== ' ';
        return (
          <label key={i} className="flex items-start gap-1.5" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={done}
              disabled={!interactive}
              onChange={() => void setBodyText(itemId, toggleChecklistItem(text, idx))}
              className="mt-1 h-3.5 w-3.5 shrink-0 accent-[var(--sticky-ink)]"
            />
            <span className={cn(done && 'line-through opacity-60')}>{m[2]}</span>
          </label>
        );
      })}
    </div>
  );
}

export function StickyNote({
  item,
  selected,
  className,
  interactive = true,
}: {
  item: Item;
  selected?: boolean;
  className?: string;
  interactive?: boolean;
}) {
  const body = useLiveQuery(() => db.stickyBodies.get(item.id), [item.id]);
  const tidy = usePrefs((p) => p.tidyStickies);
  const colour = item.colour ?? 'lemon';
  return (
    <div
      className={cn(
        'relative flex flex-col rounded-[3px] p-3 text-sm text-sticky-ink shadow-[0_1px_2px_rgba(0,0,0,0.2),0_4px_10px_rgba(0,0,0,0.18)] transition-transform',
        STICKY_SIZES[body?.size ?? 'M'],
        selected && 'ring-2 ring-focus ring-offset-2 ring-offset-bg',
        className,
      )}
      style={{
        background: `var(--sticky-${colour})`,
        fontFamily: 'var(--sticky-font)',
        transform: tidy ? undefined : `rotate(${tiltFor(item.id)}deg)`,
      }}
      aria-label={`${COLOUR_LABELS[colour]} sticky: ${item.title || 'empty'}`}
    >
      {item.pinned && <Pin size={13} className="absolute top-1.5 right-1.5 opacity-60" aria-label="Pinned" />}
      {item.task?.done && <Check size={14} className="absolute top-1.5 left-1.5 opacity-60" aria-label="Done" />}
      {body ? <StickyText itemId={item.id} text={body.text} interactive={interactive} /> : null}
      {body && !body.text && <span className="opacity-50">Empty sticky</span>}
    </div>
  );
}

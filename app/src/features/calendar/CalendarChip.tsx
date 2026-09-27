import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { AlertCircle, Repeat } from 'lucide-react';
import type { Placed } from '@/data/agenda';
import { cn } from '@/design/cn';
import { formatSpan, formatTime, isOverdue } from '@/lib/time';
import { itemTitle } from '@/features/items/kinds';

/** One entry in a calendar cell or the week's all-day row. */
export function CalendarChip({
  placed,
  onOpen,
  onPointerDown,
  onKeyDown,
  showTime = true,
  dimmed,
}: {
  placed: Placed;
  onOpen: () => void;
  onPointerDown?: (e: ReactPointerEvent) => void;
  onKeyDown?: (e: KeyboardEvent) => void;
  showTime?: boolean;
  dimmed?: boolean;
}) {
  const { item, span, projected } = placed;
  const sticky = item.kind === 'sticky';
  const colour = item.colour ?? (sticky ? 'lemon' : null);
  const done = !!item.task?.done && !projected;
  const overdue = isOverdue(item) && !projected;
  const title = itemTitle(item.title, item.kind);
  return (
    <button
      type="button"
      data-item-id={item.id}
      onClick={onOpen}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      aria-label={`${title}, ${placed.basis === 'due' ? 'due ' : ''}${formatSpan(span)}${projected ? ', upcoming repeat' : ''}${done ? ', done' : ''}${overdue ? ', overdue' : ''}`}
      aria-describedby="calendar-help"
      className={cn(
        'flex min-h-6 w-full min-w-0 select-none items-center gap-1 rounded px-1 py-0.5 text-left text-xs outline-none focus-visible:ring-2 focus-visible:ring-focus',
        sticky ? 'text-sticky-ink' : 'bg-surface-2 text-text hover:bg-accent-soft',
        projected && 'border border-dashed border-current opacity-80',
        dimmed && 'opacity-30',
      )}
      style={sticky && colour ? { background: `var(--sticky-${colour})` } : undefined}
    >
      {!sticky && colour && <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: `var(--sticky-${colour})` }} />}
      {overdue && <AlertCircle size={11} className="shrink-0 text-danger" aria-hidden />}
      {showTime && !span.allDay && <span className="shrink-0 font-mono opacity-80">{formatTime(new Date(span.start))}</span>}
      <span className={cn('truncate', done && 'line-through opacity-60')}>{title}</span>
      {item.recurrence && <Repeat size={10} className="shrink-0 opacity-60" aria-hidden />}
    </button>
  );
}

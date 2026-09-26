import { forwardRef, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { AlertCircle, Repeat } from 'lucide-react';
import type { Placed } from '@/data/agenda';
import { cn } from '@/design/cn';
import { formatSpan, isOverdue } from '@/lib/time';
import { KIND_ICONS, itemTitle } from '@/features/items/kinds';
import type { Detail } from './scale';

import type { DragKind } from './drag';

export interface TimelineCardProps {
  placed: Placed;
  detail: Exclude<Detail, 'density'>;
  horizontal: boolean;
  style: CSSProperties;
  laneLabel: string;
  active: boolean;
  dragging?: boolean;
  ghost?: boolean;
  onPointerDown?: (e: ReactPointerEvent, kind: DragKind) => void;
  onKeyDown?: (e: KeyboardEvent) => void;
  onFocus?: () => void;
  describedBy?: string;
  /** Identifies the card for keyboard focus. */
  entryKey?: string;
  /** Pushes the label along when the card starts before the visible area. */
  inset?: number;
}

/** One item on the timeline: a card when zoomed in, a chip further out (TIME-5). */
export const TimelineCard = forwardRef<HTMLDivElement, TimelineCardProps>(function TimelineCard(
  { placed, detail, horizontal, style, laneLabel, active, dragging, ghost, onPointerDown, onKeyDown, onFocus, describedBy, entryKey, inset = 0 },
  ref,
) {
  const { item, span, projected } = placed;
  const Icon = KIND_ICONS[item.kind];
  const sticky = item.kind === 'sticky';
  const done = !!item.task?.done && !projected;
  const overdue = isOverdue(item) && !projected;
  const title = itemTitle(item.title, item.kind);
  const colour = item.colour ?? (sticky ? 'lemon' : null);
  const handle = cn('absolute z-10 opacity-0 group-hover:opacity-100', horizontal ? 'inset-y-1 w-2 cursor-ew-resize' : 'inset-x-1 h-2 cursor-ns-resize');

  return (
    <div
      ref={ref}
      role={ghost ? undefined : 'button'}
      aria-hidden={ghost || undefined}
      tabIndex={ghost ? undefined : active ? 0 : -1}
      data-item-id={item.id}
      data-entry={entryKey}
      data-projected={projected || undefined}
      aria-label={`${title}, ${placed.basis === 'due' ? 'due ' : placed.basis === 'created' ? 'created ' : ''}${formatSpan(span)}, ${laneLabel}${projected ? ', upcoming repeat' : ''}${done ? ', done' : ''}${overdue ? ', overdue' : ''}`}
      aria-describedby={describedBy}
      onPointerDown={(e) => onPointerDown?.(e, 'move')}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      style={{ ...style, ...(sticky && colour ? { background: `var(--sticky-${colour})` } : {}), ...(inset ? (horizontal ? { paddingLeft: inset + 8 } : { paddingTop: inset + 4 }) : {}) }}
      className={cn(
        'group absolute flex touch-none select-none overflow-hidden rounded-[6px] border text-left outline-none focus-visible:ring-2 focus-visible:ring-focus',
        sticky ? 'border-black/10 text-sticky-ink' : 'border-border bg-surface-2 text-text',
        detail === 'chip' ? 'items-center gap-1 px-1.5 text-xs' : 'flex-col justify-center gap-0.5 px-2 py-1 text-sm leading-tight',
        // Upcoming repeats: dashed and a little faded (one fade only, to keep text readable).
        projected && 'border-dashed opacity-80',
        dragging && 'opacity-30',
        ghost && 'z-30 shadow-lg ring-2 ring-focus',
        'cursor-grab active:cursor-grabbing',
      )}
    >
      {!sticky && colour && <span aria-hidden className={cn('absolute', horizontal ? 'inset-y-0 left-0 w-1' : 'inset-x-0 top-0 h-1')} style={{ background: `var(--sticky-${colour})` }} />}
      <span className={cn('flex min-w-0 items-center gap-1.5', detail === 'card' && 'font-medium')}>
        {!sticky && detail === 'card' && <Icon size={13} className="shrink-0 opacity-70" aria-hidden />}
        {overdue && <AlertCircle size={12} className="shrink-0 text-danger" aria-hidden />}
        <span className={cn('truncate', done && 'line-through opacity-60')}>{title}</span>
        {item.recurrence && <Repeat size={11} className="shrink-0 opacity-60" aria-hidden />}
      </span>
      {detail === 'card' && (
        <span className={cn('truncate text-xs', !sticky && 'text-muted')}>
          {placed.basis === 'due' ? 'Due ' : placed.basis === 'created' ? 'Created ' : ''}
          {formatSpan(span)}
        </span>
      )}
      {detail === 'card' && onPointerDown && placed.basis !== 'created' && (
        <>
          <span aria-hidden className={cn(handle, horizontal ? 'left-0' : 'top-0')} onPointerDown={(e) => (e.stopPropagation(), onPointerDown(e, 'start'))} />
          <span aria-hidden className={cn(handle, horizontal ? 'right-0' : 'bottom-0')} onPointerDown={(e) => (e.stopPropagation(), onPointerDown(e, 'end'))} />
        </>
      )}
    </div>
  );
});

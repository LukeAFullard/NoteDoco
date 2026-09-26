import { Link } from 'react-router';
import { Pin } from 'lucide-react';
import type { MouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import { useRef } from 'react';
import type { Item } from '@/data/types';
import { cn } from '@/design/cn';
import { formatRelative } from '@/lib/dates';
import { StickyNote } from '@/features/stickies/StickyNote';
import { KIND_ICONS, KIND_LABELS, itemTitle } from './kinds';
import { ItemActionsMenu } from './ItemMenu';
import { openSticky } from '@/features/stickies/stickyDialog';

export type Density = 'row' | 'card';

export interface ItemCardProps {
  item: Item;
  density: Density;
  selected: boolean;
  selecting: boolean;
  /** Called for clicks that should select rather than open (modifier keys, selection mode, long press). */
  onSelect: (item: Item, e: { shiftKey: boolean }) => void;
  href: string;
}

function ChecklistProgress({ item }: { item: Item }) {
  const { checklistTotal: total, checklistDone: done } = item.stats;
  if (!total) return null;
  return (
    <span className="inline-flex items-center gap-1.5" aria-label={`${done} of ${total} done`}>
      <span className="h-1.5 w-12 overflow-hidden rounded-full bg-surface-2">
        <span className="block h-full bg-success" style={{ width: `${(done / total) * 100}%` }} />
      </span>
      <span className="tabular-nums">
        {done}/{total}
      </span>
    </span>
  );
}

function Tags({ tags }: { tags: string[] }) {
  if (!tags.length) return null;
  return (
    <span className="truncate">
      {tags.slice(0, 3).map((t) => (
        <span key={t} className="mr-1.5 text-accent">
          #{t}
        </span>
      ))}
    </span>
  );
}

/** One design for an item everywhere, at list-row or card size (plan §3 rule 4). */
export function ItemCard({ item, density, selected, selecting, onSelect, href }: ItemCardProps) {
  const Icon = KIND_ICONS[item.kind];
  const longPress = useRef<number | null>(null);
  const suppressClick = useRef(false);

  const onClick = (e: MouseEvent) => {
    if (suppressClick.current) {
      e.preventDefault();
      suppressClick.current = false;
      return;
    }
    if (selecting || e.metaKey || e.ctrlKey || e.shiftKey) {
      e.preventDefault();
      onSelect(item, e);
    } else if (item.kind === 'sticky') {
      // Stickies open in place, over whatever you're looking at.
      e.preventDefault();
      openSticky(item.id);
    }
  };
  // Touch: press and hold to start selecting.
  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.pointerType !== 'touch') return;
    longPress.current = window.setTimeout(() => {
      suppressClick.current = true;
      onSelect(item, { shiftKey: false });
      navigator.vibrate?.(10);
    }, 500);
  };
  const cancelLongPress = () => {
    if (longPress.current) clearTimeout(longPress.current);
    longPress.current = null;
  };

  const checkbox = (
    <input
      type="checkbox"
      aria-label={`Select ${itemTitle(item.title, item.kind)}`}
      checked={selected}
      onChange={() => onSelect(item, { shiftKey: false })}
      className={cn(
        'relative z-10 h-4 w-4 shrink-0 accent-[var(--color-accent-fill)]',
        !selecting && 'opacity-0 group-hover:opacity-100 focus:opacity-100',
      )}
    />
  );

  const link = (
    <Link
      to={href}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerUp={cancelLongPress}
      onPointerLeave={cancelLongPress}
      onPointerCancel={cancelLongPress}
      onContextMenu={(e) => selecting && e.preventDefault()}
      className="absolute inset-0 z-0 rounded-panel outline-none focus-visible:ring-2 focus-visible:ring-focus"
      aria-label={`Open ${KIND_LABELS[item.kind].toLowerCase()}: ${itemTitle(item.title, item.kind)}`}
      draggable={false}
    />
  );

  if (item.kind === 'sticky' && density === 'card') {
    return (
      <div className="group relative" data-item-id={item.id}>
        <StickyNote item={item} selected={selected} interactive={!selecting} />
        {link}
        <div className="absolute top-1 right-1 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100">
          {checkbox}
          <ItemActionsMenu items={[item]} />
        </div>
      </div>
    );
  }

  const meta = (
    <span className="flex min-w-0 items-center gap-3 text-xs text-muted">
      <span className="shrink-0 font-mono">{formatRelative(item.updatedAt)}</span>
      <ChecklistProgress item={item} />
      <Tags tags={item.tags} />
    </span>
  );

  if (density === 'row') {
    return (
      <div
        data-item-id={item.id}
        className={cn('group relative flex items-center gap-3 rounded-panel px-3 py-2.5 hover:bg-surface-2/60', selected && 'bg-accent-soft')}
      >
        {checkbox}
        {item.kind === 'sticky' ? (
          <span className="h-4 w-4 shrink-0 rounded-[2px] border border-black/10" style={{ background: `var(--sticky-${item.colour ?? 'lemon'})` }} aria-hidden />
        ) : (
          <Icon size={16} className="shrink-0 text-muted" aria-hidden />
        )}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className={cn('truncate font-medium', !item.title && 'text-muted')}>{itemTitle(item.title, item.kind)}</span>
            {item.pinned && <Pin size={12} className="shrink-0 text-accent" aria-label="Pinned" />}
          </span>
          {item.preview && <span className="block truncate text-sm text-muted">{item.preview}</span>}
        </span>
        <span className="hidden sm:block">{meta}</span>
        {link}
        <span className="relative z-10 opacity-0 group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100">
          <ItemActionsMenu items={[item]} />
        </span>
      </div>
    );
  }

  return (
    <div
      data-item-id={item.id}
      className={cn(
        'group relative flex min-h-40 flex-col gap-2 rounded-panel border border-border bg-bg p-3 transition-colors hover:border-accent/50',
        selected && 'border-accent bg-accent-soft',
      )}
    >
      {item.colour && <span className="absolute inset-x-0 top-0 h-1 rounded-t-panel" style={{ background: `var(--sticky-${item.colour})` }} />}
      <div className="flex items-center gap-2">
        {checkbox}
        <Icon size={15} className="shrink-0 text-muted" aria-hidden />
        <span className={cn('min-w-0 flex-1 truncate font-medium', !item.title && 'text-muted')}>{itemTitle(item.title, item.kind)}</span>
        {item.pinned && <Pin size={12} className="shrink-0 text-accent" aria-label="Pinned" />}
      </div>
      <p className="line-clamp-4 flex-1 text-sm text-muted">{item.preview}</p>
      {meta}
      {link}
      <span className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100">
        <ItemActionsMenu items={[item]} />
      </span>
    </div>
  );
}

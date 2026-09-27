import { Fragment } from 'react';
import { AlertCircle, CalendarDays, Check, Flag, Repeat } from 'lucide-react';
import type { Item } from '@/data/types';
import { toggleDoneWithUndo } from '@/data/actions';
import { toastWithUndo } from '@/app/undoActions';
import { cn } from '@/design/cn';
import { MENTION } from '@/lib/dateMentions';
import { describeRule, parseRule } from '@/lib/recurrence';
import { atTime, formatDay, formatSpan, isOverdue, todayLocal } from '@/lib/time';

/**
 * An item's date in a few words: "Fri 2 Oct, 15:00", "Due Mon 5 Oct", with the repeat.
 * Overdue says so in words as well as colour.
 */
export function DateBadge({ item, className }: { item: Item; className?: string }) {
  const span = item.when ?? item.due;
  if (!span) return null;
  const overdue = isOverdue(item);
  const rule = parseRule(item.recurrence);
  const isDue = !item.when;
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1 whitespace-nowrap', overdue ? 'font-medium text-danger' : 'text-muted', className)}>
      {overdue ? <AlertCircle size={12} aria-hidden /> : isDue ? <Flag size={12} aria-hidden /> : <CalendarDays size={12} aria-hidden />}
      <span className="truncate">
        {overdue ? 'Overdue: ' : isDue ? 'Due ' : ''}
        {formatSpan(span)}
      </span>
      {item.when && item.due && !overdue && <span className="sr-only">, due {formatSpan(item.due)}</span>}
      {rule && (
        <>
          <Repeat size={12} aria-hidden />
          <span className="sr-only">, repeats: {describeRule(rule)}</span>
        </>
      )}
    </span>
  );
}

/**
 * A checkbox drawn to match the theme: round for to-do items, square for checklist lines.
 */
export function CheckControl({ checked, label, onToggle, shape = 'round', className, boxClassName }: { checked: boolean; label: string; onToggle: () => void; shape?: 'round' | 'square'; className?: string; boxClassName?: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      // A 24 px target (WCAG 2.2) around a 20 px box.
      className={cn('group/check relative z-10 -m-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-focus', className)}
    >
      <span
        className={cn(
          'flex h-5 w-5 items-center justify-center border-2',
          shape === 'round' ? 'rounded-full' : 'rounded-[5px]',
          checked ? 'border-success bg-success text-bg' : 'border-muted group-hover/check:border-accent',
          boxClassName,
        )}
      >
        {checked && <Check size={12} strokeWidth={3} aria-hidden />}
      </span>
    </button>
  );
}

/** The round to-do checkbox for items that are tasks. Ticking a repeat moves it on. */
export function DoneToggle({ item, className, boxClassName }: { item: Item; className?: string; boxClassName?: string }) {
  if (!item.task) return null;
  return (
    <CheckControl
      checked={item.task.done}
      label={`Done: ${item.title || 'untitled'}`}
      onToggle={async () => toastWithUndo(await toggleDoneWithUndo(item.id))}
      className={className}
      boxClassName={boxClassName}
    />
  );
}

/** Text with `@2026-10-02` mentions shown as friendly date chips. */
export function MentionText({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  const today = todayLocal();
  for (const m of text.matchAll(MENTION)) {
    const start = m.index + m[1]!.length;
    parts.push(text.slice(last, start));
    const day = m[2]!;
    const label = m[3] ? `${formatDay(day)} ${m[3]}` : formatDay(day);
    parts.push(
      <time
        key={start}
        dateTime={m[3] ? atTime(day, m[3]).toISOString() : day}
        title={day < today ? 'In the past' : undefined}
        className={cn('rounded bg-current/10 px-1 font-medium whitespace-nowrap', day < today && 'opacity-75')}
      >
        {label}
      </time>,
    );
    last = m.index + m[0].length;
  }
  parts.push(text.slice(last));
  return <>{parts.map((p, i) => <Fragment key={i}>{p}</Fragment>)}</>;
}

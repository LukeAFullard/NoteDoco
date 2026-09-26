import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Repeat } from 'lucide-react';
import type { Group, Item } from '@/data/types';
import type { Placed, TaskLine } from '@/data/agenda';
import { toggleChecklistLineWithUndo } from '@/data/actions';
import { toastWithUndo } from '@/app/undoActions';
import { cn } from '@/design/cn';
import { stripMentions } from '@/lib/dateMentions';
import { describeRule, parseRule } from '@/lib/recurrence';
import { formatSpan, formatSpanTime, isOverdue } from '@/lib/time';
import { KIND_ICONS, itemTitle } from '@/features/items/kinds';
import { ItemActionsMenu } from '@/features/items/ItemMenu';
import { openSticky } from '@/features/stickies/stickyDialog';
import { CheckControl, DoneToggle, MentionText } from './DateBadge';

/** A link that opens a note's page, or a sticky over the current screen. */
export function ItemLink({ item, className, children }: { item: Item; className?: string; children?: ReactNode }) {
  return (
    <Link
      to={`/items/${item.id}`}
      onClick={(e) => {
        if (item.kind === 'sticky') {
          e.preventDefault();
          openSticky(item.id);
        }
      }}
      className={cn('rounded outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus', className)}
    >
      {children ?? itemTitle(item.title, item.kind)}
    </Link>
  );
}

export function GroupChip({ group }: { group: Group | undefined }) {
  if (!group) return <span>Inbox</span>;
  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: `var(--sticky-${group.colour})` }} aria-hidden />
      <span className="truncate">{group.name}</span>
    </span>
  );
}

function KindMark({ item }: { item: Item }) {
  if (item.kind === 'sticky')
    return <span className="mt-0.5 h-4 w-4 shrink-0 rounded-[2px] border border-black/10" style={{ background: `var(--sticky-${item.colour ?? 'lemon'})` }} aria-hidden />;
  const Icon = KIND_ICONS[item.kind];
  return <Icon size={16} className="mt-0.5 shrink-0 text-muted" aria-hidden />;
}

/**
 * One dated item in an agenda: time, checkbox (for to-dos), title, group and repeat.
 * `showDate` adds the full date (for lists that aren't grouped by day).
 */
export function AgendaItemRow({ entry, groups, showDate = false, time = true }: { entry: Placed; groups: Map<string, Group>; showDate?: boolean; time?: boolean }) {
  const { item, span, projected } = entry;
  const rule = parseRule(item.recurrence);
  const overdue = isOverdue(item);
  const done = !!item.task?.done && !projected;
  return (
    <li className="group flex items-start gap-3 rounded-panel px-2 py-2 hover:bg-surface-2/60" data-item-id={item.id}>
      {time && <span className="hidden w-16 shrink-0 pt-0.5 text-right font-mono text-xs text-muted sm:block">{entry.basis === 'due' ? 'Due' : span.allDay ? '' : formatSpanTime(span)}</span>}
      {item.task && !projected ? <DoneToggle item={item} className="mt-0.5" /> : <KindMark item={item} />}
      <div className="min-w-0 flex-1">
        <ItemLink item={item} className={cn('block truncate font-medium', done && 'text-muted line-through', projected && 'text-muted')} />
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 text-xs text-muted">
          {time && (entry.basis === 'due' || !span.allDay) && <span className="font-mono sm:hidden">{entry.basis === 'due' ? 'Due' : formatSpanTime(span)}</span>}
          <GroupChip group={item.groupId ? groups.get(item.groupId) : undefined} />
          {showDate && <span>{formatSpan(span)}</span>}
          {overdue && !projected && <span className="font-medium text-danger">Overdue</span>}
          {rule && (
            <span className="inline-flex items-center gap-1">
              <Repeat size={11} aria-hidden />
              {describeRule(rule)}
              {projected && ' (upcoming)'}
            </span>
          )}
        </div>
      </div>
      <span className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100">
        <ItemActionsMenu items={[item]} />
      </span>
    </li>
  );
}

/** A checklist line from inside a note or sticky, tickable in place. */
export function TaskLineRow({ line, groups, keepDate = false, time = true }: { line: TaskLine; groups: Map<string, Group>; keepDate?: boolean; time?: boolean }) {
  const { ref, item } = line;
  const text = keepDate ? ref.text : stripMentions(ref.text);
  return (
    <li className="flex items-start gap-3 rounded-panel px-2 py-2 hover:bg-surface-2/60" data-task-id={ref.id}>
      {time && <span className="hidden w-16 shrink-0 pt-0.5 text-right font-mono text-xs text-muted sm:block">{ref.date && ref.date.length > 10 ? formatSpanTime({ start: ref.date, end: null, allDay: false, tz: null }) : ''}</span>}
      <CheckControl
        shape="square"
        checked={ref.done}
        label={text || 'Checklist item'}
        onToggle={async () => toastWithUndo(await toggleChecklistLineWithUndo(item.id, Number(ref.anchor), ref.done))}
        className="mt-0.5"
      />
      <div className="min-w-0 flex-1">
        <span className={cn('block', ref.done && 'text-muted line-through')}>{text ? <MentionText text={text} /> : <span className="text-muted">Empty line</span>}</span>
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 text-xs text-muted">
          <span>
            in <ItemLink item={item} />
          </span>
          <GroupChip group={item.groupId ? groups.get(item.groupId) : undefined} />
        </span>
      </div>
    </li>
  );
}

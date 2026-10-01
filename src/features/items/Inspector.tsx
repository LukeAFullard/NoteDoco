import type { ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Bell, CalendarClock, History, Repeat } from 'lucide-react';
import { db } from '@/data/db';
import { useGroups } from '@/data/hooks';
import type { Item } from '@/data/types';
import { moveItemsWithUndo, setColourWithUndo } from '@/data/actions';
import { openDateDialog } from '@/app/ui';
import { toastWithUndo } from '@/app/undoActions';
import { Button } from '@/design/Button';
import { ColourSwatches } from '@/design/ColourSwatches';
import { formatDateTime, formatRelative } from '@/lib/dates';
import { describeRule, parseRule } from '@/lib/recurrence';
import { formatSpan } from '@/lib/time';
import { TagEditor } from '@/features/tags/TagEditor';
import { ItemLink } from '@/features/time/AgendaRow';
import { KIND_LABELS } from './kinds';
import { OPEN_HISTORY_EVENT } from './events';


function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] items-start gap-2 py-1 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-border px-4 py-3">
      <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{title}</h2>
      {children}
    </section>
  );
}

/**
 * The inspector (WS-5): an item's properties, dates, links and history in one place, beside
 * the item. Every change here is undoable like anywhere else.
 */
export function Inspector({ item }: { item: Item }) {
  const groups = useGroups() ?? [];
  const links = useLiveQuery(async () => {
    const [from, to] = await Promise.all([db.links.where('toItemId').equals(item.id).toArray(), db.links.where('fromItemId').equals(item.id).toArray()]);
    const ids = [...new Set([...from.map((l) => l.fromItemId), ...to.map((l) => l.toItemId)])];
    const items = new Map((await db.items.bulkGet(ids)).filter((i): i is Item => !!i && !i.deletedAt).map((i) => [i.id, i]));
    return { backlinks: from.map((l) => items.get(l.fromItemId)).filter((i): i is Item => !!i), outgoing: to.map((l) => items.get(l.toItemId)).filter((i): i is Item => !!i) };
  }, [item.id]);
  const versions = useLiveQuery(() => db.versions.where('itemId').equals(item.id).count(), [item.id]);
  const rule = parseRule(item.recurrence);

  return (
    <div className="text-sm">
      <Section title="Details">
        <dl>
          <Row label="Kind">{KIND_LABELS[item.kind]}</Row>
          <Row label="Group">
            <select
              aria-label="Group"
              value={item.groupId ?? ''}
              onChange={async (e) => toastWithUndo(await moveItemsWithUndo([item.id], e.target.value || null))}
              className="h-8 w-full rounded-panel border border-border bg-surface px-2"
            >
              <option value="">Inbox</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </Row>
          <Row label="Colour">
            <div className="flex flex-wrap items-center gap-2">
              <ColourSwatches label="Item colour" value={item.colour} onChange={async (c) => toastWithUndo(await setColourWithUndo([item.id], c))} />
              {item.colour && (
                <button type="button" className="text-xs text-muted underline" onClick={async () => toastWithUndo(await setColourWithUndo([item.id], null))}>
                  None
                </button>
              )}
            </div>
          </Row>
          <Row label="Tags">
            <TagEditor item={item} />
          </Row>
        </dl>
      </Section>

      <Section title="Dates">
        <dl>
          <Row label="When">{item.when ? formatSpan(item.when) : <span className="text-muted">None</span>}</Row>
          <Row label="Due">{item.due ? formatSpan(item.due) : <span className="text-muted">None</span>}</Row>
          {rule && (
            <Row label="Repeats">
              <span className="inline-flex items-center gap-1">
                <Repeat size={13} aria-hidden /> {describeRule(rule)}
                {rule.mode === 'copy' && ' (a fresh copy each time)'}
              </span>
            </Row>
          )}
          {item.reminders.length > 0 && (
            <Row label="Reminders">
              <ul>
                {item.reminders.map((r) => (
                  <li key={r.id} className="flex items-center gap-1">
                    <Bell size={13} aria-hidden /> {formatDateTime(r.at)}
                    {r.firedAt && <span className="text-xs text-muted">(done)</span>}
                  </li>
                ))}
              </ul>
            </Row>
          )}
          {item.task && <Row label="To-do">{item.task.done ? `Done ${item.task.doneAt ? formatRelative(item.task.doneAt) : ''}` : 'Open'}</Row>}
        </dl>
        <Button className="mt-2" size="sm" onPress={() => openDateDialog([item.id])}>
          <CalendarClock size={14} aria-hidden /> Change dates…
        </Button>
      </Section>

      <Section title="Links">
        {links && links.backlinks.length + links.outgoing.length > 0 ? (
          <dl>
            {links.backlinks.length > 0 && (
              <Row label="Linked from">
                <ul>{links.backlinks.map((i) => <li key={i.id} className="truncate"><ItemLink item={i} /></li>)}</ul>
              </Row>
            )}
            {links.outgoing.length > 0 && (
              <Row label="Links to">
                <ul>{links.outgoing.map((i) => <li key={i.id} className="truncate"><ItemLink item={i} /></li>)}</ul>
              </Row>
            )}
          </dl>
        ) : (
          <p className="text-muted">No links yet. Notes that link here with [[{item.title || 'its title'}]] will show up here.</p>
        )}
      </Section>

      <Section title="Info">
        <dl>
          <Row label="Created">
            <span title={formatDateTime(item.createdAt)}>{formatRelative(item.createdAt)}</span>
          </Row>
          <Row label="Edited">
            <span title={formatDateTime(item.updatedAt)}>{formatRelative(item.updatedAt)}</span>
          </Row>
          <Row label="Words">{item.stats.words}</Row>
          {item.stats.checklistTotal > 0 && (
            <Row label="Checklist">
              {item.stats.checklistDone} of {item.stats.checklistTotal} done
            </Row>
          )}
          {item.kind === 'note' && (
            <Row label="Versions">
              <span className="flex flex-wrap items-center gap-2">
                {versions ?? 0}
                <Button size="sm" variant="ghost" onPress={() => window.dispatchEvent(new CustomEvent(OPEN_HISTORY_EVENT, { detail: item.id }))}>
                  <History size={14} aria-hidden /> Version history
                </Button>
              </span>
            </Row>
          )}
        </dl>
      </Section>
    </div>
  );
}

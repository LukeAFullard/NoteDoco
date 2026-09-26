import { lazy, useEffect } from 'react';
import { Link, useParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronLeft } from 'lucide-react';
import { db } from '@/data/db';
import { Pane } from '@/app/Pane';
import { setCurrentGroup, useUi } from '@/app/ui';
import { EmptyState } from '@/design/EmptyState';
import { StickyNote } from '@/features/stickies/StickyNote';
import { openSticky } from '@/features/stickies/stickyDialog';
import { ItemActionsMenu } from './ItemMenu';
import { KIND_LABELS, itemTitle } from './kinds';

const NoteEditor = lazy(() => import('@/features/notes/NoteEditor').then((m) => ({ default: m.NoteEditor })));

/** Opens any item by id: notes in the editor, stickies in their dialog. */
export function ItemPage() {
  const { itemId = '' } = useParams();
  const item = useLiveQuery(() => db.items.get(itemId), [itemId]);
  const group = useLiveQuery(async () => (item?.groupId ? db.groups.get(item.groupId) : null), [item?.groupId]);
  const focusMode = useUi((s) => s.focusMode);

  useEffect(() => {
    if (item) setCurrentGroup(item.groupId);
  }, [item]);

  if (item === undefined) return null;
  if (!item || item.deletedAt) {
    return (
      <Pane title="Not found">
        <EmptyState title="This item isn’t here" body="It may have been moved to the Trash. You can restore it from there." action={<Link className="text-accent underline" to="/trash">Open Trash</Link>} />
      </Pane>
    );
  }

  const back = item.groupId ? `/groups/${item.groupId}` : '/inbox';
  const title = (
    <span className="flex items-center gap-1 text-base">
      <Link to={back} className="flex items-center gap-1 font-normal text-muted hover:text-accent" aria-label={`Back to ${group?.name ?? 'Inbox'}`}>
        <ChevronLeft size={18} aria-hidden />
        <span className="max-w-40 truncate">{group?.name ?? 'Inbox'}</span>
      </Link>
      <span className="text-muted">/</span>
      <span className="truncate">{itemTitle(item.title, item.kind)}</span>
    </span>
  );

  return (
    <Pane title={focusMode ? '' : title} actions={!focusMode && <ItemActionsMenu items={[item]} />}>
      {item.kind === 'note' ? (
        <NoteEditor item={item} />
      ) : item.kind === 'sticky' ? (
        <div className="flex flex-col items-center gap-4 p-10">
          <button type="button" onClick={() => openSticky(item.id)} aria-label="Edit sticky">
            <StickyNote item={item} />
          </button>
          <p className="text-sm text-muted">Tap the sticky to edit it.</p>
        </div>
      ) : (
        <EmptyState title={`${KIND_LABELS[item.kind]}s arrive in a later phase`} body="This item was created by a newer version of NoteDoco." />
      )}
    </Pane>
  );
}

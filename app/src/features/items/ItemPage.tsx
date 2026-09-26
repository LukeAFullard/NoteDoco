import { lazy, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronLeft, PanelRight } from 'lucide-react';
import { db } from '@/data/db';
import { Pane } from '@/app/Pane';
import { setCurrentGroup, useUi } from '@/app/ui';
import { EmptyState } from '@/design/EmptyState';
import { StickyNote } from '@/features/stickies/StickyNote';
import { openSticky } from '@/features/stickies/stickyDialog';
import { ItemActionsMenu } from './ItemMenu';
import { Inspector } from './Inspector';
import { IconButton } from '@/design/Button';
import { Dialog } from '@/design/Dialog';
import { useLocalPref } from '@/lib/localPref';
import { KIND_LABELS, itemTitle } from './kinds';

const NoteEditor = lazy(() => import('@/features/notes/NoteEditor').then((m) => ({ default: m.NoteEditor })));

/** Wide enough for the inspector beside the item (it opens as a sheet otherwise). */
function useWide() {
  const q = '(min-width: 1100px)';
  const [wide, setWide] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = () => setWide(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return wide;
}

/** Opens any item by id: notes in the editor, stickies in their dialog. */
export function ItemPage() {
  const { itemId = '' } = useParams();
  const item = useLiveQuery(() => db.items.get(itemId), [itemId]);
  const group = useLiveQuery(async () => (item?.groupId ? db.groups.get(item.groupId) : null), [item?.groupId]);
  const focusMode = useUi((s) => s.focusMode);
  const [inspector, setInspector] = useLocalPref('inspector', false);
  const wide = useWide();

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
    <Pane
      title={focusMode ? '' : title}
      actions={
        !focusMode && (
          <span className="flex items-center gap-1">
            <IconButton label={inspector ? 'Hide the inspector' : 'Show the inspector'} size="sm" aria-pressed={inspector} onPress={() => setInspector(!inspector)}>
              <PanelRight size={16} />
            </IconButton>
            <ItemActionsMenu items={[item]} />
          </span>
        )
      }
    >
      <div className="flex h-full min-h-0">
        <div className="min-h-0 min-w-0 flex-1">
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
        </div>
        {inspector && !focusMode && wide && (
          <aside className="w-80 shrink-0 overflow-y-auto border-l border-border bg-bg" aria-label="Inspector">
            <Inspector item={item} />
          </aside>
        )}
      </div>
      {inspector && !wide && (
        <Dialog isOpen onOpenChange={(o) => !o && setInspector(false)} title="Inspector">
          <Inspector item={item} />
        </Dialog>
      )}
    </Pane>
  );
}

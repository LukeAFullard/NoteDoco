import { useLiveQuery } from 'dexie-react-hooks';
import { StickyNote as StickyIcon, X } from 'lucide-react';
import { db } from '@/data/db';
import { useUi } from '@/app/ui';
import { StickyNote } from './StickyNote';
import { openSticky } from './stickyDialog';

/**
 * The sticky dock (STK-7): pinned stickies in a tray you can open from any screen. The button
 * only appears once something is pinned, so it never clutters an empty app.
 */
export function StickyDock() {
  const open = useUi((s) => s.dockOpen);
  const pinned = useLiveQuery(async () => (await db.items.where('kind').equals('sticky').toArray()).filter((i) => i.pinned && !i.deletedAt && !i.archived), []);
  if (!pinned?.length) return null;

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => useUi.setState({ dockOpen: true })}
          className="fixed bottom-20 left-3 z-30 flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-2 text-sm shadow-lg hover:border-accent md:bottom-4 md:left-[17rem]"
          aria-label={`Pinned stickies (${pinned.length})`}
        >
          <StickyIcon size={16} className="text-accent" aria-hidden /> {pinned.length}
        </button>
      )}
      {open && (
        <aside
          aria-label="Pinned stickies"
          className="fixed inset-x-0 bottom-16 z-30 max-h-[45vh] overflow-y-auto border-t border-border bg-bg/95 p-4 shadow-2xl backdrop-blur md:bottom-0 md:left-64"
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Pinned stickies</h2>
            <button type="button" aria-label="Close pinned stickies" className="text-muted hover:text-text" onClick={() => useUi.setState({ dockOpen: false })}>
              <X size={18} />
            </button>
          </div>
          <ul className="flex flex-wrap gap-5">
            {pinned.map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => openSticky(s.id)} aria-label={`Edit sticky: ${s.title || 'empty'}`} className="text-left">
                  <StickyNote item={s} className="!min-h-32 !w-40" />
                </button>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </>
  );
}

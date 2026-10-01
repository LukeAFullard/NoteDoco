import { useEffect } from 'react';
import { Inbox } from 'lucide-react';
import { Pane } from '@/app/Pane';
import { setCurrentGroup } from '@/app/ui';
import { EmptyState } from '@/design/EmptyState';
import { Kbd } from '@/design/Kbd';
import { useItems } from '@/data/hooks';
import { CollectionControls, ItemCollection } from '@/features/items/ItemCollection';
import { useLocalCollectionPrefs } from '@/features/items/useCollectionPrefs';
import { NewMenu } from '@/features/capture/NewMenu';
import { ItemDropZone } from '@/features/items/DropZone';
import { moveItemsWithUndo } from '@/data/actions';
import { toastWithUndo } from '@/app/undoActions';
import { usePasteToCreate } from '@/features/capture/usePasteToCreate';

export function InboxPage() {
  const items = useItems(null);
  const [prefs, setPrefs] = useLocalCollectionPrefs('inbox', { view: 'list', sort: 'updated' });
  useEffect(() => setCurrentGroup(null), []);
  usePasteToCreate(null);

  return (
    <Pane
      title="Inbox"
      actions={
        <div className="flex items-center gap-2">
          <CollectionControls prefs={prefs} onChange={setPrefs} />
          <NewMenu compact />
        </div>
      }
    >
      {items && (
        <ItemDropZone
          className="min-h-[calc(100%-1px)]"
          onDropItems={async (ids) => {
            const moving = ids.filter((id) => !items.some((i) => i.id === id));
            if (moving.length) toastWithUndo(await moveItemsWithUndo(moving, null));
          }}
        >
          <ItemCollection
            items={items.filter((i) => !i.archived)}
            prefs={prefs}
            empty={
              <EmptyState
                icon={<Inbox size={32} />}
                title="Nothing waiting"
                body="Quick notes and stickies you haven’t filed land here, so you never have to decide where something goes first. Press N for a note, S for a sticky, or just paste."
                action={
                  <span className="flex gap-2 text-sm text-muted">
                    <Kbd>N</Kbd> note <Kbd>S</Kbd> sticky
                  </span>
                }
              />
            }
          />
        </ItemDropZone>
      )}
    </Pane>
  );
}

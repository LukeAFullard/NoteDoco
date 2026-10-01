import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Hash, Pencil } from 'lucide-react';
import { itemsWithTag, listTags, normaliseTag, renameTag } from '@/data/repos/tags';
import { Pane } from '@/app/Pane';
import { toastWithUndo } from '@/app/undoActions';
import { Dialog } from '@/design/Dialog';
import { Button } from '@/design/Button';
import { EmptyState } from '@/design/EmptyState';
import { ItemCollection } from '@/features/items/ItemCollection';
import { useLocalCollectionPrefs } from '@/features/items/useCollectionPrefs';

function RenameDialog({ tag, onClose }: { tag: string; onClose: () => void }) {
  const [to, setTo] = useState(tag);
  const navigate = useNavigate();
  const all = useLiveQuery(listTags, [], []);
  const target = normaliseTag(to);
  const merging = target !== tag && all.some((t) => t.tag === target);
  return (
    <Dialog isOpen onOpenChange={(o) => !o && onClose()} title={`Rename #${tag}`}>
      <form
        className="flex flex-col gap-3 p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          const n = await renameTag(tag, target);
          onClose();
          if (n) {
            toastWithUndo(merging ? `Merged #${tag} into #${target} (${n})` : `Renamed #${tag} to #${target} (${n})`);
            navigate(`/tags/${encodeURIComponent(target)}`, { replace: true });
          }
        }}
      >
        <label className="flex flex-col gap-1.5 text-sm">
          New name
          <input autoFocus value={to} onChange={(e) => setTo(e.target.value)} className="h-10 rounded-panel border border-border bg-bg px-3 outline-none focus:border-accent" />
        </label>
        <p className="text-sm text-muted">
          {merging ? `#${target} already exists, so the two tags will be merged. ` : ''}Tags written in note and sticky text are updated too.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onPress={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isDisabled={!target || target === tag}>
            {merging ? 'Merge' : 'Rename'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function TagItems({ tag }: { tag: string }) {
  const items = useLiveQuery(() => itemsWithTag(tag), [tag]);
  const [prefs, setPrefs] = useLocalCollectionPrefs('tag', { view: 'list', sort: 'updated' });
  const [renaming, setRenaming] = useState(false);
  return (
    <Pane
      title={`#${tag}`}
      actions={
        <div className="flex items-center gap-2">
          <select aria-label="View" value={prefs.view} onChange={(e) => setPrefs({ ...prefs, view: e.target.value as 'list' | 'cards' })} className="h-8 rounded-panel border border-border bg-surface px-2 text-sm">
            <option value="list">List</option>
            <option value="cards">Cards</option>
          </select>
          <Button size="sm" onPress={() => setRenaming(true)}>
            <Pencil size={14} aria-hidden /> Rename or merge
          </Button>
        </div>
      }
    >
      {items && <ItemCollection items={items} prefs={prefs} empty={<EmptyState title={`Nothing tagged #${tag}`} body="Tags appear when you add them to a note or sticky." />} />}
      {renaming && <RenameDialog tag={tag} onClose={() => setRenaming(false)} />}
    </Pane>
  );
}

/** All tags with counts (GRP-4); /tags/:tag lists what's tagged. */
export function TagsPage() {
  const { tag } = useParams();
  const tags = useLiveQuery(listTags, []);
  if (tag) return <TagItems key={tag} tag={decodeURIComponent(tag)} />;
  return (
    <Pane title="Tags">
      {tags && tags.length > 0 ? (
        <ul className="flex flex-wrap gap-2 p-4">
          {tags.map((t) => (
            <li key={t.tag}>
              <Link to={`/tags/${encodeURIComponent(t.tag)}`} className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm hover:border-accent">
                <span className="text-accent">#{t.tag}</span>
                <span className="font-mono text-xs text-muted">{t.count}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        tags && (
          <EmptyState
            icon={<Hash size={32} />}
            title="No tags yet"
            body="Type #anything in a note or sticky, or use Add tag on a note. Tags cut across groups, so you can find related things wherever they live."
          />
        )
      )}
    </Pane>
  );
}

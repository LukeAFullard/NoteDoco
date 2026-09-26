import { useId, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Hash, X } from 'lucide-react';
import type { Item } from '@/data/types';
import { setManualTags } from '@/data/repos/items';
import { listTags, normaliseTag } from '@/data/repos/tags';
import { cn } from '@/design/cn';

/**
 * Tags on one item (GRP-4). Tags added here can be removed here; #tags written in the text are
 * shown too, but you remove those by editing the text.
 */
export function TagEditor({ item, tone = 'ui' }: { item: Item; tone?: 'ui' | 'sticky' }) {
  const [draft, setDraft] = useState('');
  const listId = useId();
  const all = useLiveQuery(listTags, [], []);
  const inline = item.tags.filter((t) => !item.manualTags.includes(t));

  const add = async (raw: string) => {
    const tags = raw.split(/[,\s]+/).map(normaliseTag).filter(Boolean);
    if (tags.length) await setManualTags(item.id, [...item.manualTags, ...tags]);
    setDraft('');
  };
  const chip = cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs', tone === 'sticky' ? 'bg-black/10 text-sticky-ink' : 'bg-accent-soft text-accent');

  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Tags">
      <Hash size={14} className={tone === 'sticky' ? 'text-sticky-ink/60' : 'text-muted'} aria-hidden />
      {item.manualTags.map((t) => (
        <span key={t} className={chip}>
          {t}
          <button type="button" aria-label={`Remove tag ${t}`} onClick={() => void setManualTags(item.id, item.manualTags.filter((m) => m !== t))} className="opacity-60 hover:opacity-100">
            <X size={12} />
          </button>
        </span>
      ))}
      {inline.map((t) => (
        <span key={t} className={cn(chip, 'opacity-70')} title="Written in the text">
          {t}
        </span>
      ))}
      <input
        value={draft}
        list={listId}
        aria-label="Add a tag"
        placeholder="Add tag"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            void add(draft);
          } else if (e.key === 'Backspace' && !draft && item.manualTags.length) {
            void setManualTags(item.id, item.manualTags.slice(0, -1));
          }
        }}
        onBlur={() => draft && void add(draft)}
        className={cn('h-6 w-24 min-w-0 bg-transparent text-xs outline-none', tone === 'sticky' ? 'placeholder:text-sticky-ink/50' : 'placeholder:text-muted')}
      />
      <datalist id={listId}>
        {all.filter((t) => !item.tags.includes(t.tag)).map((t) => (
          <option key={t.tag} value={t.tag} />
        ))}
      </datalist>
    </div>
  );
}

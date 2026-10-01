import { Link } from 'react-router';
import { Fragment } from 'react';
import type { SearchHit } from '@/search/SearchIndex';
import { useGroups } from '@/data/hooks';
import { KIND_ICONS, itemTitle } from '@/features/items/kinds';
import { openSticky } from '@/features/stickies/stickyDialog';

/** Wraps the query's words in <mark> (case-insensitive). */
export function Highlight({ text, terms }: { text: string; terms: string[] }) {
  const words = terms.filter((t) => t.length > 1).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!words.length) return <>{text}</>;
  const parts = text.split(new RegExp(`(${words.join('|')})`, 'gi'));
  return (
    <>
      {parts.map((p, i) =>
        i % 2 ? (
          <mark key={i} className="rounded-sm bg-accent-soft text-inherit">
            {p}
          </mark>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}

export function SearchResults({ hits, onOpen }: { hits: SearchHit[]; onOpen?: () => void }) {
  const groups = new Map((useGroups() ?? []).map((g) => [g.id, g]));
  return (
    <ul className="divide-y divide-border" aria-label="Results">
      {hits.map((h) => {
        const Icon = KIND_ICONS[h.kind];
        const g = h.groupId ? groups.get(h.groupId) : null;
        return (
          <li key={h.id}>
            <Link
              to={`/items/${h.id}`}
              onClick={(e) => {
                onOpen?.();
                if (h.kind === 'sticky') {
                  e.preventDefault();
                  openSticky(h.id);
                }
              }}
              className="flex gap-3 px-4 py-3 hover:bg-surface-2/60"
            >
              {h.kind === 'sticky' ? (
                <span className="mt-0.5 h-4 w-4 shrink-0 rounded-[2px]" style={{ background: `var(--sticky-${h.colour ?? 'lemon'})` }} aria-hidden />
              ) : (
                <Icon size={16} className="mt-0.5 shrink-0 text-muted" aria-hidden />
              )}
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="truncate font-medium">
                    <Highlight text={itemTitle(h.title, h.kind)} terms={h.terms} />
                  </span>
                  <span className="shrink-0 text-xs text-muted">{g ? g.name : 'Inbox'}</span>
                </span>
                {h.snippet && (
                  <span className="line-clamp-2 text-sm text-muted">
                    <Highlight text={h.snippet} terms={h.terms} />
                  </span>
                )}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

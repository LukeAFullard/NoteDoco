import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router';
import { Search as SearchIcon, X } from 'lucide-react';
import { Pane } from '@/app/Pane';
import { EmptyState } from '@/design/EmptyState';
import { readPref, writePref } from '@/lib/localPref';
import { useSearch } from '@/search/client';
import { SearchResults } from './SearchResults';

const FILTER_HINTS = ['#tag', 'kind:sticky', 'colour:coral', 'in:work', 'is:pinned', 'is:open', 'is:archived'];

/** Full search (FIND-1, FIND-2): typo-tolerant text plus filters, with recent searches. */
export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const input = useRef<HTMLInputElement>(null);
  const { hits, loading } = useSearch(q);
  const recent = readPref<string[]>('recentSearches', []);

  useEffect(() => input.current?.focus(), []);
  // Remember searches that found something, once the user pauses.
  useEffect(() => {
    if (!q.trim() || !hits.length) return;
    const t = setTimeout(() => writePref('recentSearches', [q, ...recent.filter((r) => r !== q)].slice(0, 8)), 1500);
    return () => clearTimeout(t);
  }, [q, hits.length, recent]);

  const setQ = (v: string) => setParams(v ? { q: v } : {}, { replace: true });

  return (
    <Pane title="Search">
      <div className="border-b border-border p-4">
        <div className="flex items-center gap-2 rounded-panel border border-border bg-bg px-3 focus-within:border-accent">
          <SearchIcon size={16} className="text-muted" aria-hidden />
          <input
            ref={input}
            type="search"
            aria-label="Search notes and stickies"
            placeholder="Search notes and stickies…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-11 min-w-0 flex-1 bg-transparent text-base outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {q && (
            <button type="button" aria-label="Clear search" onClick={() => setQ('')} className="text-muted hover:text-text">
              <X size={16} />
            </button>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
          {FILTER_HINTS.map((f) => (
            <button key={f} type="button" onClick={() => setQ(`${q.trim()} ${f}`.trim())} className="rounded-full border border-border px-2 py-0.5 font-mono text-muted hover:border-accent hover:text-text">
              {f}
            </button>
          ))}
        </div>
      </div>
      {q.trim() ? (
        hits.length ? (
          <SearchResults hits={hits} />
        ) : (
          !loading && <EmptyState icon={<SearchIcon size={32} />} title="No matches" body="Try fewer words, or remove a filter." />
        )
      ) : recent.length ? (
        <div className="p-4">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Recent searches</h2>
          <ul className="flex flex-wrap gap-2">
            {recent.map((r) => (
              <li key={r}>
                <button type="button" onClick={() => setQ(r)} className="rounded-full border border-border px-3 py-1 text-sm hover:border-accent">
                  {r}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <EmptyState icon={<SearchIcon size={32} />} title="Search everything" body="Titles, text, stickies and tags, archived ones included. Small typos are forgiven. Add filters like #tag or kind:sticky to narrow things down." />
      )}
    </Pane>
  );
}

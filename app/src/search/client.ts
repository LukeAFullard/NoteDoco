import { useEffect, useState } from 'react';
import type { SearchHit } from './SearchIndex';
import type { SearchRequest, SearchResponse } from '@/workers/search.worker';

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, (hits: SearchHit[]) => void>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('../workers/search.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<SearchResponse>) => {
      pending.get(e.data.id)?.(e.data.hits);
      pending.delete(e.data.id);
    };
  }
  return worker;
}

export function searchItems(q: string, limit = 50): Promise<SearchHit[]> {
  const id = nextId++;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    const req: SearchRequest = { id, q, limit };
    getWorker().postMessage(req);
  });
}

/** Results for a query, updated as the user types (latest query wins). */
export function useSearch(q: string, limit = 50): { hits: SearchHit[]; loading: boolean } {
  const [state, setState] = useState<{ q: string; hits: SearchHit[] }>({ q: '', hits: [] });
  useEffect(() => {
    let current = true;
    const t = setTimeout(() => {
      void searchItems(q, limit).then((hits) => current && setState({ q, hits }));
    }, 60);
    return () => {
      current = false;
      clearTimeout(t);
    };
  }, [q, limit]);
  // While a new query runs, keep showing the previous results rather than flashing empty.
  return { hits: q.trim() ? state.hits : [], loading: state.q !== q };
}

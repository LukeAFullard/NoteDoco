/// <reference lib="webworker" />
import Dexie from 'dexie';
import { db } from '@/data/db';
import { SearchIndex, type SearchHit } from '@/search/SearchIndex';

/**
 * Search runs here so indexing and typo-tolerant matching never block typing. The index is
 * rebuilt from the database on start, then updated whenever any tab changes items.
 */
export interface SearchRequest {
  id: number;
  q: string;
  limit?: number;
}
export interface SearchResponse {
  id: number;
  hits: SearchHit[];
}

const index = new SearchIndex(db);
let syncing: Promise<unknown> = index.sync();
let timer: ReturnType<typeof setTimeout> | null = null;

Dexie.on('storagemutated', (parts: Record<string, unknown>) => {
  if (!Object.keys(parts).some((k) => k.includes('/items') || k.includes('/noteBodies') || k.includes('/stickyBodies') || k.includes('/groups'))) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    syncing = syncing.then(() => index.sync());
  }, 150);
});

self.onmessage = async (e: MessageEvent<SearchRequest>) => {
  // A change is waiting to be indexed: do it now, or this search would show the old state.
  if (timer) {
    clearTimeout(timer);
    timer = null;
    syncing = syncing.then(() => index.sync());
  }
  await syncing;
  const { id, q, limit } = e.data;
  const res: SearchResponse = { id, hits: index.search(q, limit) };
  (self as unknown as Worker).postMessage(res);
};

import MiniSearch from 'minisearch';
import type { NoteDocoDB } from '@/data/db';
import type { Group, Item, ItemKind } from '@/data/types';
import { stripMarkdownLine } from '@/lib/textInfo';
import { hasFilters, parseQuery } from './query';

interface Doc {
  id: string;
  title: string;
  text: string;
  tags: string;
  tagList: string[];
  kind: ItemKind;
  groupId: string | null;
  colour: string | null;
  pinned: boolean;
  checklistTotal: number;
  checklistDone: number;
  updatedAt: string;
  archived: boolean;
}

export interface SearchHit {
  id: string;
  title: string;
  kind: ItemKind;
  groupId: string | null;
  colour: string | null;
  /** Archived itself, or in an archived group. */
  archived: boolean;
  snippet: string;
  /** The words that actually matched (after typo and prefix matching), for highlighting. */
  terms: string[];
  score: number;
}

/** Plain readable text for indexing (Markdown syntax stripped, attachment URLs removed). */
const readable = (text: string) =>
  text
    .split('\n')
    .map(stripMarkdownLine)
    .filter(Boolean)
    .join('\n');

function snippetFor(text: string, terms: string[], length = 140): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  const lower = flat.toLowerCase();
  const at = terms.map((t) => lower.indexOf(t.toLowerCase())).filter((i) => i >= 0).sort((a, b) => a - b)[0] ?? 0;
  const start = Math.max(0, at - 40);
  return (start > 0 ? '…' : '') + flat.slice(start, start + length) + (start + length < flat.length ? '…' : '');
}

/** How much an archived item's text score counts, so it ranks below live matches. */
const ARCHIVED_BOOST = 0.3;

/**
 * Full-text index over items not in the trash (FIND-1), kept in sync incrementally by
 * comparing each item's `rev`. Archived items are found too, ranked lower and marked.
 * Runs in a worker in the app and directly in tests.
 */
export class SearchIndex {
  private mini = new MiniSearch<Doc>({
    fields: ['title', 'text', 'tags'],
    storeFields: ['title', 'tagList', 'kind', 'groupId', 'colour', 'pinned', 'checklistTotal', 'checklistDone', 'updatedAt', 'archived'],
    searchOptions: { boost: { title: 3, tags: 2 }, prefix: true, fuzzy: 0.2, combineWith: 'AND' },
  });
  private revs = new Map<string, number>();
  private texts = new Map<string, string>();
  private groups: Group[] = [];
  /** Groups that are archived, or inside an archived group. */
  private archivedGroups = new Set<string>();

  constructor(private db: NoteDocoDB) {}

  get size() {
    return this.revs.size;
  }

  /** Brings the index up to date with the database; returns how many items changed. */
  async sync(): Promise<number> {
    const [items, groups] = await Promise.all([this.db.items.toArray(), this.db.groups.toArray()]);
    this.groups = groups.filter((g) => !g.deletedAt);
    const byId = new Map(this.groups.map((g) => [g.id, g]));
    const archivedUp = (g: Group | undefined, depth = 0): boolean =>
      !!g && depth < 50 && (g.archived || archivedUp(g.parentId ? byId.get(g.parentId) : undefined, depth + 1));
    this.archivedGroups = new Set(this.groups.filter((g) => archivedUp(g)).map((g) => g.id));
    const live = new Map(items.filter((i) => !i.deletedAt).map((i) => [i.id, i]));
    let changed = 0;
    for (const id of [...this.revs.keys()]) {
      if (!live.has(id)) {
        this.mini.discard(id);
        this.revs.delete(id);
        this.texts.delete(id);
        changed++;
      }
    }
    const stale = [...live.values()].filter((i) => this.revs.get(i.id) !== i.rev);
    if (stale.length) {
      const ids = stale.map((i) => i.id);
      const [notes, stickies] = await Promise.all([this.db.noteBodies.bulkGet(ids), this.db.stickyBodies.bulkGet(ids)]);
      stale.forEach((item, k) => {
        const raw = notes[k]?.text ?? stickies[k]?.text ?? '';
        this.upsert(item, notes[k]?.format === 'plain' ? raw : readable(raw));
      });
      changed += stale.length;
    }
    return changed;
  }

  private upsert(item: Item, text: string) {
    if (this.revs.has(item.id)) this.mini.discard(item.id);
    this.mini.add({
      id: item.id,
      title: item.title,
      text,
      tags: item.tags.join(' '),
      tagList: item.tags,
      kind: item.kind,
      groupId: item.groupId,
      colour: item.colour,
      pinned: item.pinned,
      checklistTotal: item.stats.checklistTotal,
      checklistDone: item.stats.checklistDone,
      updatedAt: item.updatedAt,
      archived: item.archived,
    });
    this.revs.set(item.id, item.rev);
    // Snippets show the text after the title, since the title is displayed anyway.
    const lines = text.split('\n');
    this.texts.set(item.id, lines[0]?.trim() === item.title.trim() ? lines.slice(1).join('\n') : text);
  }

  search(q: string, limit = 50): SearchHit[] {
    const p = parseQuery(q);
    if (!p.text && !hasFilters(p)) return [];
    const groupIds = p.groups.length
      ? new Set(this.groups.filter((g) => p.groups.some((name) => g.name.toLowerCase().startsWith(name))).map((g) => g.id))
      : null;
    const isArchived = (r: Record<string, unknown>) => r.archived === true || this.archivedGroups.has(r.groupId as string);
    const filter = (r: Record<string, unknown>) =>
      (!p.archived || isArchived(r)) &&
      (!p.kinds.length || p.kinds.includes(r.kind as ItemKind)) &&
      (!p.colours.length || p.colours.includes(r.colour as never)) &&
      (!groupIds || groupIds.has(r.groupId as string)) &&
      (!p.tags.length || p.tags.every((t) => (r.tagList as string[]).includes(t))) &&
      (!p.pinned || r.pinned === true) &&
      (!p.open || (r.checklistTotal as number) > (r.checklistDone as number)) &&
      (!p.done || ((r.checklistTotal as number) > 0 && r.checklistTotal === r.checklistDone));

    // Filters (including tags) match exactly; the text part uses fuzzy, prefix search.
    // Archived items count for less, so live ones come first unless the match is much better.
    const results = p.text
      ? this.mini.search(p.text, { filter, boostDocument: (_id, _term, r) => (r && isArchived(r) ? ARCHIVED_BOOST : 1) })
      : this.mini.search(MiniSearch.wildcard, { filter }).sort(
          (a, b) => Number(isArchived(a)) - Number(isArchived(b)) || String(b.updatedAt).localeCompare(String(a.updatedAt)),
        );
    return results.slice(0, limit).map((r) => ({
      id: r.id,
      title: r.title as string,
      kind: r.kind as ItemKind,
      groupId: (r.groupId as string | null) ?? null,
      colour: (r.colour as string | null) ?? null,
      archived: isArchived(r),
      snippet: snippetFor(this.texts.get(r.id) ?? '', r.terms),
      terms: r.terms,
      score: r.score,
    }));
  }
}

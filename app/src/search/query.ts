import type { ItemKind } from '@/data/types';
import { COLOUR_KEYS, type ColourKey } from '@/lib/palette';

/** A parsed search: free text plus filters (FIND-2). The UI's filter chips write the same syntax. */
export interface ParsedQuery {
  text: string;
  tags: string[];
  kinds: ItemKind[];
  colours: ColourKey[];
  groups: string[]; // group names, lower-case, matched as prefixes
  pinned: boolean;
  open: boolean; // has unticked checklist items
  done: boolean; // checklist fully ticked
}

const KINDS: Record<string, ItemKind> = { note: 'note', notes: 'note', sticky: 'sticky', stickies: 'sticky', ink: 'ink', board: 'board' };

export function parseQuery(q: string): ParsedQuery {
  const out: ParsedQuery = { text: '', tags: [], kinds: [], colours: [], groups: [], pinned: false, open: false, done: false };
  const words: string[] = [];
  // Tokens: key:"quoted value", key:value, #tag, or plain words.
  for (const m of q.matchAll(/(\w+):"([^"]*)"|(\w+):(\S+)|#([\p{L}\p{N}_/-]+)|(\S+)/gu)) {
    const [, qk, qv, k, v, tag, word] = m;
    const key = (qk ?? k)?.toLowerCase();
    const val = (qv ?? v ?? '').toLowerCase();
    if (tag) out.tags.push(tag.toLowerCase());
    else if (key === 'tag') out.tags.push(val.replace(/^#/, ''));
    else if (key === 'kind' && KINDS[val]) out.kinds.push(KINDS[val]!);
    else if ((key === 'colour' || key === 'color') && (COLOUR_KEYS as readonly string[]).includes(val)) out.colours.push(val as ColourKey);
    else if (key === 'in') out.groups.push(val);
    else if (key === 'is' && val === 'pinned') out.pinned = true;
    else if (key === 'is' && val === 'open') out.open = true;
    else if (key === 'is' && val === 'done') out.done = true;
    else words.push(m[0]);
    void word;
  }
  out.text = words.join(' ');
  return out;
}

export const hasFilters = (p: ParsedQuery) =>
  p.tags.length + p.kinds.length + p.colours.length + p.groups.length > 0 || p.pinned || p.open || p.done;

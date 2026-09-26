import type { Group, Item } from '@/data/types';
import type { Placed } from '@/data/agenda';
import { COLOUR_KEYS, COLOUR_LABELS, type ColourKey } from '@/lib/palette';
import { KIND_LABELS } from '@/features/items/kinds';

/**
 * Timeline layout (ARCHITECTURE §10): which lane each item goes in, then greedy interval
 * packing into rows per lane. Items that don't fit in the lane's rows collapse into "+N" pills.
 * Positions are along the time axis, so the same layout serves lanes mode (time → x) and
 * columns mode (time → y).
 */

export type LaneMode = 'group' | 'tag' | 'kind' | 'colour' | 'none';
export const LANE_MODE_LABELS: Record<LaneMode, string> = { group: 'Group', tag: 'Tag', kind: 'Kind', colour: 'Colour', none: 'One lane' };

export interface Lane {
  key: string;
  label: string;
  /** A token colour key for the lane's dot. */
  colour: ColourKey | null;
  depth: number;
}

export const INBOX_LANE = 'inbox';
export const NO_TAG_LANE = 'no-tag';
export const NO_COLOUR_LANE = 'no-colour';

/** The lanes an item belongs in. Tag lanes can hold the same item more than once. */
export function laneKeysFor(item: Item, mode: LaneMode): string[] {
  switch (mode) {
    case 'group':
      return [item.groupId ?? INBOX_LANE];
    case 'tag':
      return item.tags.length ? item.tags : [NO_TAG_LANE];
    case 'kind':
      return [item.kind];
    case 'colour':
      return [item.colour ?? NO_COLOUR_LANE];
    case 'none':
      return ['all'];
  }
}

/**
 * Every possible lane for a mode, in its natural order. `groups` must be in tree order (with
 * depth); tags come from the items in view.
 */
export function allLanes(mode: LaneMode, groups: { group: Group; depth: number }[], tags: string[]): Lane[] {
  switch (mode) {
    case 'group':
      return [
        { key: INBOX_LANE, label: 'Inbox', colour: null, depth: 0 },
        ...groups.filter((g) => !g.group.archived).map(({ group, depth }) => ({ key: group.id, label: group.name, colour: group.colour, depth })),
      ];
    case 'tag':
      return [...tags.map((t) => ({ key: t, label: `#${t}`, colour: null, depth: 0 })), { key: NO_TAG_LANE, label: 'No tag', colour: null, depth: 0 }];
    case 'kind':
      return (['note', 'sticky', 'ink', 'board'] as const).map((k) => ({ key: k, label: `${KIND_LABELS[k]}s`, colour: null, depth: 0 }));
    case 'colour':
      return [...COLOUR_KEYS.map((c) => ({ key: c, label: COLOUR_LABELS[c], colour: c, depth: 0 })), { key: NO_COLOUR_LANE, label: 'No colour', colour: null, depth: 0 }];
    case 'none':
      return [{ key: 'all', label: 'Everything', colour: null, depth: 0 }];
  }
}

/** Applies the saved order (unknown lanes keep their natural place after known ones) and hides lanes. */
export function orderLanes(lanes: Lane[], order: string[], hidden: string[]): Lane[] {
  const rank = new Map(order.map((k, i) => [k, i]));
  return lanes
    .map((l, i) => ({ l, r: rank.get(l.key) ?? order.length + i }))
    .sort((a, b) => a.r - b.r)
    .map(({ l }) => l)
    .filter((l) => !hidden.includes(l.key));
}

export interface Entry {
  key: string;
  placed: Placed;
  lane: string;
  /** Start and end along the time axis, end already widened to the minimum size. */
  a: number;
  b: number;
}

export interface Positioned extends Entry {
  row: number;
}

export interface Cluster {
  lane: string;
  pos: number;
  count: number;
  /** Items hidden in this pill. */
  keys: string[];
}

export interface PackedLane {
  entries: Positioned[];
  clusters: Cluster[];
  /** Rows used, including a row for pills when there are any. */
  rows: number;
}

/**
 * Greedy packing: longest-first within the same start, each entry in the first row where it
 * fits. Past `maxRows`, entries go into a "+N" pill grouped by `bucket` px along the axis.
 */
export function packLane(entries: Entry[], maxRows: number, gap = 4, bucket = 120): PackedLane {
  const sorted = [...entries].sort((x, y) => x.a - y.a || y.b - y.a - (x.b - x.a) || x.key.localeCompare(y.key));
  const rowEnds: number[] = [];
  const out: Positioned[] = [];
  const pills = new Map<number, Cluster>();
  for (const e of sorted) {
    let row = rowEnds.findIndex((end) => end + gap <= e.a);
    if (row < 0 && rowEnds.length < maxRows) row = rowEnds.length;
    if (row < 0) {
      const b = Math.floor(e.a / bucket);
      const pill = pills.get(b) ?? { lane: e.lane, pos: b * bucket, count: 0, keys: [] };
      pill.count++;
      pill.keys.push(e.key);
      pills.set(b, pill);
      continue;
    }
    rowEnds[row] = e.b;
    out.push({ ...e, row });
  }
  const clusters = [...pills.values()];
  return { entries: out, clusters, rows: Math.max(1, rowEnds.length) + (clusters.length ? 1 : 0) };
}

/** Counts per bucket along the axis, for density bars when zoomed far out. */
export function density(entries: Entry[], bucket: number): Map<number, number> {
  const counts = new Map<number, number>();
  for (const e of entries) {
    for (let b = Math.floor(e.a / bucket); b <= Math.floor(Math.max(e.a, e.b - 1) / bucket); b++) counts.set(b, (counts.get(b) ?? 0) + 1);
  }
  return counts;
}

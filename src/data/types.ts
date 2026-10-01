import type { ColourKey } from '@/lib/palette';

export type Id = string; // UUIDv7
export type Instant = string; // ISO 8601 UTC
export type LocalDate = string; // "2026-09-26": floating all-day date
export type OrderKey = string; // fractional index

export interface Meta {
  id: Id;
  createdAt: Instant;
  updatedAt: Instant;
  /** Set = in Trash (purged after 30 days). Also the future sync tombstone. */
  deletedAt: Instant | null;
  /** Incremented on every write. */
  rev: number;
  /** Per-install device id of the last writer (sync-ready). */
  updatedBy: string;
}

export interface GroupViewPrefs {
  view: 'list' | 'cards' | 'board' | 'timeline' | 'calendar';
  sort: 'manual' | 'updated' | 'created' | 'title' | 'due';
}

export interface Group extends Meta {
  parentId: Id | null;
  name: string;
  colour: ColourKey;
  icon: string | null;
  order: OrderKey;
  archived: boolean;
  boardId: Id | null;
  viewPrefs: GroupViewPrefs;
}

export type ItemKind = 'note' | 'ink' | 'sticky' | 'board';

export interface TimeSpan {
  start: LocalDate | Instant;
  end: LocalDate | Instant | null;
  allDay: boolean;
  tz: string | null;
}

export interface Reminder {
  id: Id;
  at: Instant;
  firedAt: Instant | null;
}

export interface ItemStats {
  checklistTotal: number;
  checklistDone: number;
  words: number;
}

export interface Item extends Meta {
  kind: ItemKind;
  groupId: Id | null; // null = Inbox
  order: OrderKey;
  title: string;
  preview: string;
  colour: ColourKey | null;
  /** All tags (indexed): tags added with the tag picker plus #tags written in the text. */
  tags: string[];
  /** Tags added with the tag picker. The rest of `tags` comes from the text. */
  manualTags: string[];
  pinned: boolean;
  archived: boolean;
  when: TimeSpan | null;
  due: TimeSpan | null;
  reminders: Reminder[];
  recurrence: string | null;
  task: { done: boolean; doneAt: Instant | null } | null;
  stats: ItemStats;
  thumbnailId: Id | null;
}

export interface NoteBody {
  itemId: Id;
  format: 'markdown' | 'plain';
  text: string;
}

export interface StickyBody {
  itemId: Id;
  text: string;
  inkPageId: Id | null;
  size: 'S' | 'M' | 'L';
  stuckTo: { itemId: Id; x: number; y: number } | null;
}

export interface Paper {
  size: 'a4' | 'letter' | 'endless' | 'infinite';
  template: 'blank' | 'lined' | 'grid' | 'dot' | 'cornell' | 'planner';
  colour: 'white' | 'cream' | 'dark';
}

export type StrokeTool = 'ballpoint' | 'fountain' | 'marker' | 'highlighter';

export interface InkDoc {
  id: Id;
  itemId: Id | null;
  layout: 'pages' | 'block';
  paper: Paper;
}

export interface InkPage {
  id: Id;
  docId: Id;
  order: OrderKey;
  paper: Paper;
  background: { attachmentId: Id; pdfPage: number } | null;
}

export interface Stroke {
  id: Id;
  pageId: Id;
  tool: StrokeTool;
  colour: string;
  size: number;
  opacity: number;
  /** false when the device gave no pressure (the renderer simulates it). Absent = true. */
  pressure?: boolean;
  points: Uint8Array;
  bbox: [number, number, number, number];
  createdAt: Instant;
}

export interface Board {
  itemId: Id;
  background: 'plain' | 'dots' | 'grid' | 'cork';
  inkPageId: Id;
}

export interface BoardNode {
  id: Id;
  boardId: Id;
  type: 'item' | 'text' | 'image' | 'frame';
  itemId: Id | null;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  z: OrderKey;
  style: Record<string, unknown>;
}

export interface EdgeEnd {
  nodeId: Id;
  side: 'top' | 'right' | 'bottom' | 'left' | null;
}

export interface BoardEdge {
  id: Id;
  boardId: Id;
  from: EdgeEnd;
  to: EdgeEnd;
  label: string;
  style: Record<string, unknown>;
}

export interface Link {
  fromItemId: Id;
  toItemId: Id;
  kind: 'wikilink' | 'embed';
}

export interface TaskRef {
  id: Id;
  itemId: Id;
  anchor: string;
  text: string;
  date: LocalDate | Instant | null;
  done: boolean;
}

export interface Attachment {
  id: Id;
  itemId: Id;
  name: string;
  mime: string;
  size: number;
  sha256: string;
  blob: Blob;
  createdAt: Instant;
}

export interface Version {
  id: Id;
  itemId: Id;
  createdAt: Instant;
  reason: 'idle' | 'restore' | 'import' | 'migration';
  snapshot: Uint8Array;
}

export interface Layout {
  id: Id;
  kind: 'timeline' | 'workspace';
  name: string;
  spec: unknown;
}

export interface Setting {
  key: string;
  value: unknown;
}

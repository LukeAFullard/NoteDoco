# NoteDoco v2 — Architecture

> Companion to [`PROJECT_PLAN.md`](../PROJECT_PLAN.md). This document covers *how* to build what the plan describes. Anything marked **(spike)** is a hypothesis to be confirmed by the Phase 0 spikes before it's built for real.

## 1. Constraints that shape everything

- **No backend.** A static site on GitHub Pages. All logic and data live in the browser.
- **Offline-first.** Data lives in IndexedDB on the device. The network is never required.
- **Very different content types:** rich text, handwriting documents with tens of thousands of strokes, spatial boards, and time-based queries across all of them.
- **Must feel native on:** iPad Safari + Apple Pencil, Android Chrome + S Pen, Windows Edge/Chrome + pen, and desktop mouse/keyboard.
- **Portable data.** Everything must export to open formats (Markdown, SVG/PDF, JSON Canvas, iCalendar).

## 2. Stack

| Concern | Choice | Why | Considered |
|---|---|---|---|
| Build and UI | Vite 8, React 19, TypeScript 7 (strict) | Keep what works; the richest ecosystem for editors and canvases | Svelte/Solid: smaller, but not worth a switch |
| Styling | Tailwind CSS v4 + CSS custom properties for design tokens | Tokens make theming (light/dark, sticky palette) one place | CSS Modules |
| Accessible UI primitives | React Aria Components | Strong accessibility, plus internationalised date pickers and calendars, which an organiser needs | Radix UI |
| Routing | React Router 8, hash mode | Works on GitHub Pages; pane layout is serialised into the URL | TanStack Router |
| Persistent data | Dexie 4 over IndexedDB, with `useLiveQuery` | Schema versions and migrations, compound and multi-entry indexes, reactive queries that update every open view and tab | `idb` (v1; too low-level), RxDB, SQLite-WASM on OPFS |
| UI state | Zustand | Small and simple, for panes, selection and tool settings | Redux Toolkit, Jotai |
| Text editor | TipTap 3 (ProseMirror) + `@tiptap/markdown` **(spike P0.8)** | Custom nodes (sketch block, date chip, wikilink), official two-way markdown, good mobile support, MIT core | Milkdown (markdown-first fallback), Lexical, CodeMirror live preview |
| Source mode | A plain monospace text area | Exact raw-markdown editing with nothing extra to download, and iPad Scribble works in it | CodeMirror 6 (revisit if people want highlighting in source mode) |
| Ink | Custom engine: Pointer Events + `perfect-freehand` + Canvas 2D + `rbush` **(spike P0.7)** | Handwriting-grade control (pages, palm rejection, pen buttons) and a licence-free core for the product's key feature | tldraw SDK (production needs a licence key: the hobby tier keeps a watermark, commercial is paid); Excalidraw (whiteboard-first, hand-drawn look) |
| Boards | The same canvas core, with a DOM layer for cards and stickies | Real text elements for editing, accessibility and crisp type; one camera for ink and cards | xyflow (node graphs), tldraw |
| Timeline | Custom: a time-scale module plus virtualised DOM layout | The signature feature. FullCalendar's timeline/resource views are paid add-ons; vis-timeline looks dated and is hard to integrate. | vis-timeline, FullCalendar Premium |
| Calendar | Custom month/week grids on `@internationalized/date` | Shares queries and cards with the timeline | FullCalendar (MIT core) |
| Dates | `Intl` plus small helpers in `lib/time.ts`, `chrono-node` (natural language, loaded on demand), a built-in RRULE subset in `lib/recurrence.ts` | Small, and exactly the semantics we need (floating all-day dates, clamped month ends) | `date-fns`, `rrule`; Temporal once broadly shipped |
| Search | MiniSearch in a Web Worker | About 6 KB gzipped; prefix, fuzzy and field boosting; fine up to tens of thousands of items | FlexSearch (faster beyond ~100k docs), Orama |
| Command palette | `cmdk` | Accessible and composable | Custom |
| Drag and drop (lists, sidebar, columns) | `dnd-kit` | Pointer, touch and keyboard sensors | Pragmatic drag and drop |
| Virtualised lists | TanStack Virtual, when a list needs it (the timeline has its own windowing) | Long lists | react-window |
| Zip | `fflate` (already used) | Fast; streams large backups | JSZip |
| PDF | `pdf-lib` (vector export), `pdf.js` (import and annotate, lazy-loaded) | Permissive licences | jsPDF (v1) |
| Ordering | `fractional-indexing` | Reorder without renumbering; merges cleanly if sync arrives later | Integer positions |
| Testing | Vitest, Testing Library, `fake-indexeddb`, Playwright, axe-core | Matches v1, plus end-to-end and accessibility coverage | — |

Heavy modules (editor, ink engine, PDF, calendar) are lazy-loaded so the app shell stays small.

## 3. Code layout

```
src/
  app/           shell, routing, panes, providers, command palette
  design/        tokens, primitives (Button, Menu, Dialog, Toast, DatePicker…), icons
  data/          Dexie schema, repositories, migrations, undo stack, live-query hooks
  kinds/         one module per item kind (see below)
    note/  ink/  sticky/  board/
  canvas/        shared camera, input pipeline, gestures, render layers (used by ink and boards)
  features/
    groups/  inbox/  today/  timeline/  calendar/  tasks/  search/  time/
    capture/  history/  backup/  import-export/  reminders/  settings/  panes/  onboarding/
  workers/       search index, thumbnails, import/export parsing
  lab/           prototypes such as the ink lab (spike P0.7)
  spikes/        experiment tests that back decisions (e.g. the markdown round-trip corpus)
  lib/           ids, dates, fractional ordering, markdown helpers, colour palette
  test/          fixtures (including v1 databases), helpers
```

**Item-kind registry.** Each kind exports the same interface, so lists, boards, the timeline and search never need `switch (kind)`:

```ts
interface ItemKindModule {
  kind: ItemKind;
  icon: Icon;
  Card: Component<{ item: Item; density: 'chip' | 'row' | 'card' }>; // one design, three sizes
  Editor: LazyComponent<{ itemId: Id }>;
  create(input: CreateInput): Promise<Id>;
  searchText(itemId: Id): Promise<string>;       // feeds the search worker
  exporters: Exporter[];                          // md, txt, pdf, svg, png, canvas…
  duplicate(itemId: Id): Promise<Id>;
}
```

Adding a kind later (audio, PDF document) means adding a module, not editing every view.

## 4. Data model

```ts
type Id = string;        // UUIDv7: sortable by creation time, safe to create on any device
type Instant = string;   // ISO 8601 UTC, e.g. "2026-09-26T09:30:00.000Z"
type LocalDate = string; // "2026-09-26": a floating calendar date (all-day), never shifted by time zone
type OrderKey = string;  // fractional index for manual ordering

interface Meta {
  id: Id;
  createdAt: Instant;
  updatedAt: Instant;
  deletedAt: Instant | null; // set = in Trash (purged after 30 days); also the future sync tombstone
  rev: number;               // incremented on every write
  updatedBy: string;         // per-install device id of the last writer
}

type ColourKey = 'lemon' | 'apricot' | 'coral' | 'lilac' | 'sky' | 'mint' | 'sand' | 'slate';

interface Group extends Meta {
  parentId: Id | null;
  name: string;
  colour: ColourKey;
  icon: string | null;       // emoji or icon name
  order: OrderKey;
  archived: boolean;
  boardId: Id | null;        // the group's corkboard (a board item), created on first use
  viewPrefs: GroupViewPrefs; // last view, sort, filters
}

type ItemKind = 'note' | 'ink' | 'sticky' | 'board';

interface Item extends Meta {
  kind: ItemKind;
  groupId: Id | null;        // null = Inbox
  order: OrderKey;
  title: string;             // explicit, or derived from the first line
  preview: string;           // derived plain-text excerpt for cards and search
  colour: ColourKey | null;
  tags: string[];            // all tags: picker tags + #tags found in the text (indexed)
  manualTags: string[];      // tags added with the tag picker
  pinned: boolean;
  archived: boolean;
  when: TimeSpan | null;     // its place on the timeline and calendar
  due: TimeSpan | null;
  reminders: Reminder[];
  recurrence: string | null; // RFC 5545 RRULE subset
  task: { done: boolean; doneAt: Instant | null } | null; // item-level to-do, e.g. a to-do sticky
  stats: { checklistTotal: number; checklistDone: number; words: number }; // derived on save
  thumbnailId: Id | null;    // preview image for ink notes and boards
}

interface TimeSpan {
  start: LocalDate | Instant;
  end: LocalDate | Instant | null; // null = a single point in time
  allDay: boolean;
  tz: string | null;               // IANA zone for timed items, e.g. "Pacific/Auckland"
}

interface Reminder { id: Id; at: Instant; firedAt: Instant | null }

// Bodies live in their own tables, so lists, the timeline and search stay light.
interface NoteBody   { itemId: Id; format: 'markdown' | 'plain'; text: string }
interface StickyBody { itemId: Id; text: string; inkPageId: Id | null; size: 'S' | 'M' | 'L';
                       stuckTo: { itemId: Id; x: number; y: number } | null }
interface InkDoc     { id: Id; itemId: Id | null; layout: 'pages' | 'block'; paper: Paper } // block = sketch inside a note
interface InkPage    { id: Id; docId: Id; order: OrderKey; paper: Paper;
                       background: { attachmentId: Id; pdfPage: number } | null }
interface Stroke     { id: Id; pageId: Id; tool: StrokeTool; colour: string; size: number; opacity: number;
                       pressure?: boolean; // false = the device gave none, so the renderer simulates it
                       points: Uint8Array; bbox: [number, number, number, number]; createdAt: Instant }
interface InkElement { id: Id; pageId: Id; kind: 'text' | 'image'; x: number; y: number; w: number; h: number;
                       text: string; fontSize: number; colour: string; attachmentId: Id | null; createdAt: Instant }
interface Board      { itemId: Id; background: 'plain' | 'dots' | 'grid' | 'cork'; inkPageId: Id }
interface BoardNode  { id: Id; boardId: Id; type: 'item' | 'text' | 'image' | 'frame'; itemId: Id | null;
                       x: number; y: number; w: number; h: number; rotation: number; z: OrderKey; style: NodeStyle }
interface BoardEdge  { id: Id; boardId: Id; from: EdgeEnd; to: EdgeEnd; label: string; style: EdgeStyle }
interface Link       { fromItemId: Id; toItemId: Id; kind: 'wikilink' | 'embed' } // derived index
interface TaskRef    { id: Id; itemId: Id; anchor: string; text: string;       // derived: one per checklist line
                       date: LocalDate | Instant | null; done: boolean }
interface Attachment { id: Id; itemId: Id; name: string; mime: string; size: number; sha256: string;
                       blob: Blob; createdAt: Instant }
interface Version    { id: Id; itemId: Id; createdAt: Instant;
                       reason: 'idle' | 'restore' | 'import' | 'migration'; snapshot: Uint8Array } // compressed
interface Layout     { id: Id; kind: 'timeline' | 'workspace'; name: string; spec: unknown }
interface Setting    { key: string; value: unknown }
```

**How the plan's features map onto it:**

- A sticky on a board is a `BoardNode` of type `item` pointing at the sticky's `Item`. The same note on three boards means three nodes and one item.
- A sticky that isn't on any board still appears on the stickies wall, ordered by `order`.
- Each board has one infinite `InkPage` for its handwriting layer.
- Checklist lines (from notes and checklist stickies) are indexed into a derived `TaskRef` table, with dates taken from their `@date` chips. Today and Tasks query it without parsing every note.

**Indexes:**

- items: `kind`, `[groupId+order]`, `tags` (multi-entry), `when.start`, `due.start`, `createdAt`, `updatedAt`, `deletedAt`
- strokes and inkElements: `pageId`
- boardNodes: `boardId`, `itemId`
- links: `fromItemId`, `toItemId`
- taskRefs: `itemId`, `date` (`done` is filtered in memory: IndexedDB can't index booleans)
- attachments and versions: `itemId`

Items with no date simply don't appear in the date indexes. That's what we want.

**Version 2 (Phase 2)** added a `recurrence` index on items (only repeating items have a string there, so it lists exactly them) and filled `taskRefs` for existing notes. `taskRefs` is derived data: it's rewritten on every body save, and rebuilt after a restore or the v1 migration rather than trusted from a backup. `data/agenda.ts` holds the shared date queries (`placedBetween` with repeats expanded, dated checklist lines, overdue items) used by Today, Tasks, the timeline and the calendar.

**Version 3 (Phase 3)** added the `inkElements` table (text boxes and images on ink pages). Ink colours are stored as palette keys (`"blue"`) or `#rrggbb`, so the same stroke reads well on white, cream and dark paper. A typed note's sketch is an `InkDoc` with `layout: 'block'` and `itemId` = the note, written in its Markdown as `![sketch](ndoco:ink/<doc id>)`.

## 5. Storage and durability

- **Database:** Dexie over IndexedDB, named `notedoco`. The v1 database (`note-doco-db`) is read during migration and otherwise left untouched.
- **Shared origin.** GitHub Pages serves every project site of an account from one origin (`<user>.github.io`). They all share IndexedDB, `localStorage`, the storage quota and the persistence grant. So: use unique database names, prefix every `localStorage` key, and keep the service-worker scope at `/NoteDoco/`. A custom domain would isolate the app completely.
- **If storage fails, say so.** Show a blocking banner with backup/export options. Never fall back silently to memory (v1's failure mode). That covers saves failing later too (the device filling up, the browser closing the database): `reportStorageError` in `data/health.ts` shows the banner, and a global `unhandledrejection` listener catches saves nothing else handled. The note editor shows "Not saved" and tries again on the next change.
- **Blobs** (images, PDFs, audio later) are stored as `Blob`s in IndexedDB. Thumbnails are generated as WebP in a worker. Consider OPFS for large media later; v2.0 doesn't need it.
- **Persistent storage.** Call `navigator.storage.persist()` after the user has created real content, not on first load, with a short explanation. Show `navigator.storage.estimate()` as a meter in Settings.
- **iOS Safari** deletes script-written data for sites without user interaction in 7 days of browser use. Home Screen web apps are the documented exemption. Persistent storage protects against deletion when the device runs low on space, but WebKit doesn't clearly say it lifts the 7-day rule, so we don't rely on it. On iOS the app shows a gentle, dismissible "Add to Home Screen to keep your notes safe" guide, and backup reminders stay on by default.
- **Crash safety.** Editors write through a debounced save (≤ 500 ms) and flush on `visibilitychange`/`pagehide`. Ink commits each stroke on pointer-up.
- **Changes from elsewhere.** The note editor watches its note's stored text: if it changes somewhere else (a checklist line ticked in Today, another pane) and this editor has nothing waiting to save, it reloads, so its next save never writes over that change.
- **Multiple tabs.** Live queries propagate changes across tabs. `BroadcastChannel` carries UI events; Web Locks guard exclusive jobs (migrations, backups, trash purge).
- **Migrations.** Each Dexie version has an upgrade function and a test against fixture databases. An automatic backup is taken before any migration that rewrites data.

## 6. Sync-ready, without building sync

Cheap choices now keep every sync option open later:

- UUIDv7 IDs: no collisions across devices.
- `updatedAt`, `rev` and a per-install `deviceId` on writes. Deletes are tombstones (`deletedAt`); records are only hard-deleted when the trash is purged.
- Fractional ordering, so two devices reordering never renumber each other's items.
- Bodies are whole-document snapshots per record.

Later options, to be recorded in an ADR at that phase:

- (a) record-level last-writer-wins sync through a small end-to-end-encrypted relay. Simplest, and fine for one person with several devices.
- (b) CRDT documents for text and ink (Yjs has the biggest editor ecosystem; Automerge 3 has cut memory use substantially), if concurrent editing matters.
- (c) file-based sync through a folder the user picks (Chromium desktop only).

## 7. Text editor

- **TipTap 3:** StarterKit, task list, table, code block (lowlight), image (required: without it images are silently dropped), link, placeholder, plus custom nodes:
  - `SketchBlock`: an inline ink document (NOTE-8)
  - `DateChip`: `@fri` → a date, from `chrono-node`
  - `WikiLink`: the node ships in Phase 1 so `[[links]]` are stored unescaped; link features come in Phase 5 (prototype: `src/spikes/wikiLink.ts`)
- **Markdown is the canonical storage.** Custom nodes stay readable as plain Markdown:
  - Sketch: `![sketch](ndoco:ink/<id>)`. On export this becomes `assets/<id>.svg`.
  - Date chip: `@2026-10-03`, readable as text and re-parsed on load.
  - Wikilink: `[[Title]]`, or `[[Group/Title]]` when titles clash. This matches Obsidian's path links in the exported folder. Links resolve to IDs in the `links` table and are rewritten when a note is renamed.
- **Plain-text notes** use a plain text area, stored byte-for-byte.
- **Source mode** is a monospace text area over the raw Markdown. Switching modes round-trips through Markdown.
- **Attachments** (pasted or dropped images and files) are stored as blobs and referenced in Markdown as `ndoco:attachment/<id>`; the editor's image node view swaps in a blob URL. Export rewrites these to files in an `assets/` folder.
- **History:** a compressed snapshot (fflate) on open, at most every 5 minutes while editing, and on leaving; identical snapshots are skipped and each note keeps its first version plus the newest 150.
- **Derived on save** (in a worker if large): the preview, checklist stats, tags, date mentions and links. These are written to the item and the derived tables, so list, timeline and tasks queries never parse bodies.
- **Round-trip safety:** a Markdown corpus in CI asserts parse → serialise stability (spike P0.8 creates it).
- **Keep iPad Scribble working.** Use real `contenteditable`/inputs, and don't swallow input events in custom key handlers.

## 8. Ink engine

### 8.1 Input pipeline

- The canvas element gets `touch-action: none`, `user-select: none` and `-webkit-touch-callout: none`. These are scoped to the canvas, never the page, so page zoom stays accessible.
- On `pointerdown`, the role depends on `pointerType` and settings:
  - **pen:** use the active tool. Barrel button (`buttons & 2`) = configurable secondary tool; eraser end (`buttons & 32`) = eraser.
  - **touch:** if a pen has been seen on this device, or "draw with finger" is off, it's a gesture (pan, pinch, 2-finger tap = undo, 3-finger tap = redo). Otherwise it draws.
  - **mouse:** left button draws; middle button or Space-drag pans; Ctrl/⌘-wheel zooms around the cursor.
- **Palm rejection** (the web has no palm flag, so these are heuristics):
  - ignore touches while a pen is down or hovering, and for about 300 ms after pen-up;
  - ignore touches with a large contact area (`width`/`height` over a tuned threshold);
  - if a pen arrives within about 100 ms of a touch stroke starting, retract that stroke.
- **Full-rate samples.** On `pointermove`, read `getCoalescedEvents()` for every hardware sample; without it, Apple Pencil curves come out as straight segments. Supported in Chromium, Firefox and Safari 18.2+. `getPredictedEvents()` only draws a temporary predicted tail on the "wet" layer; it's never stored.
- **Per point:** world `x`, `y`; `pressure`, normalised because devices without pressure report defaults and `perfect-freehand` can simulate pressure; tilt (`altitudeAngle`/`azimuthAngle` or `tiltX`/`tiltY`) where available; and `t` in milliseconds since stroke start.
- **Chromium-only extras**, feature-detected with nothing depending on them: the `pointerrawupdate` event, the Ink API delegated ink trail, and a `desynchronized` canvas for the wet layer.
- **Not exposed to the web:** Apple Pencil double-tap and squeeze. So the toolbar keeps a one-tap pen/eraser toggle within reach.

### 8.2 Rendering

Four layers, bottom to top:

1. **Paper:** the template (lines, grid, dots, Cornell), drawn as a cached pattern.
2. **Dry ink:** canvas tiles (about 512 px) at the current zoom bucket. Highlighter strokes render on a tile layer beneath pen strokes, so highlights never cover ink.
3. **Wet ink:** one small canvas for the stroke being drawn.
4. **DOM overlay:** text boxes, images, stickies, lasso and selection handles.

How strokes are drawn:

- A stroke's points go through `perfect-freehand` to get an outline polygon, then a `Path2D` (cached per stroke and level of detail), then a fill.
- While a pinch or zoom is in progress, the existing tiles are CSS-transformed. When it settles, the visible tiles re-render at the new resolution so strokes stay crisp. At far zoom, points are simplified (Ramer–Douglas–Peucker).
- On `pointerup`, the stroke is committed to the model, drawn into the affected dry tiles, and the wet canvas is cleared, all in the same frame, so there's no flicker or double stroke.

### 8.3 Model and storage

- **Point encoding (spike):** quantise coordinates to 1/16 px and store varint deltas, plus pressure as `uint8` and time delta as `uint16`. That's roughly 4–8 bytes per point in one `Uint8Array` per stroke. Backups are additionally compressed with `fflate`.
- **Loading:** strokes are stored per page and loaded by `pageId`. An `rbush` spatial index is built in memory for hit-testing, erasing, lasso and viewport culling.
- **Precise erase** splits a stroke into new strokes. The originals are kept in the undo stack.
- **Undo/redo** is a per-document command stack (add, remove, transform, restyle). History snapshots for ink come in Phase 5.

### 8.4 Tools

| Tool | Behaviour |
|---|---|
| Ballpoint / fountain / marker | `perfect-freehand` presets: low thinning; pressure thinning with taper; wide with a soft edge |
| Highlighter | Fixed width, 30–40% opacity, flat caps, drawn on the highlighter layer |
| Stroke eraser | Candidates from `rbush`, then distance-to-polyline test |
| Precise eraser | Splits strokes where the eraser path crosses them |
| Lasso | Polygon hit test (a stroke is selected when enough of its points fall inside). The transform is previewed as a matrix and applied on commit. |
| Shape snap | Pen held still for about 500 ms at the end of a stroke fits candidates (line, ellipse, rectangle, triangle, arrow) by least squares and corner detection. If the error is under a threshold, the stroke is replaced with a clean shape. Undo restores the original. |
| Gestures (P6) | Scratch-out = rapid zigzag over strokes (erase what it crosses); circle-to-select = a closed loop around strokes. Use heuristics, with the $P point-cloud recogniser if needed. |

### 8.5 Ink budgets

- Wet-stroke script work under 4 ms per frame; stroke commit under 8 ms.
- 60 fps pan/zoom on a page with 20,000 strokes; page open under 300 ms.

### 8.6 As built (Phase 3)

| Module | What it does |
|---|---|
| `canvas/camera.ts` | Camera maths (`screen = world × zoom + offset`), fit-width, clamping so pages stay reachable, fling inertia |
| `canvas/paper.ts` | Page sizes (CSS px at 96 dpi, so pages print at real size), vertical page layout, templates drawn with canvas calls |
| `canvas/inputRouter.ts` | Palm-rejection state machine (pure, unit tested); a second finger turns a one-finger stroke into a pinch |
| `canvas/model.ts` | Strokes per page with an `rbush` index; undo/redo as change sets of strokes and elements; precise-erase splitting; lasso hit-testing; transforms |
| `canvas/engine.ts` | Input, camera, tools and rendering; reports changes (`onChange`) for saving and state (`onState`) for the toolbar |
| `canvas/render.ts` | Shared drawing for the canvas, page thumbnails, PNG and print |
| `canvas/shapes.ts` | Shape recognition (RDP corners, rectangle and ellipse fits) |
| `canvas/export.ts` | PDF, SVG, PNG and print (lazy). Paper is drawn into a recording context and replayed as SVG or PDF |
| `features/ink/` | The editor (`InkSurface`), toolbar, pickers, selection bar, page sorter, paper and pen settings, text boxes and images, sketch dialog and preview, thumbnails |

- **Coordinates:** world space stacks the pages centred on x = 0; strokes and elements are stored in *page* coordinates, so reordering pages never rewrites them.
- **Layers as built:** paper canvas → DOM layer for text boxes and images (moved with one CSS transform) → dry ink canvas → wet canvas (the stroke being drawn, the lasso, a selection being moved, and selection handles). All canvases are viewport-sized and redrawn from vectors when the camera moves; tiles are part of the performance pass after device testing.
- **Saving:** every user action is one change set, saved in order through a queue in the editor (one small record per stroke). Undo and redo are change sets too, so they save the same way. Page operations (add, move, duplicate, delete, paper) go through app-level undo with a toast; the editor reads pages with a live query, so those undos and other panes show up straight away.
- **Shape snapping:** a stroke held still for 500 ms is recognised; the clean shape replaces it as a second change, so Undo first brings back the stroke as drawn.
- **Deleted pages** are only marked (`InkPage.deletedAt`), keeping their ink, and are purged with the Trash (after 30 days, or when it's emptied). Restoring a backup by merge replaces an item's ink as a whole when the backup's copy of the item wins (ink has no edit times of its own), so erased strokes never come back.
- **Known limitation:** the same ink note open in two panes at once (or a sketch open while its note is open elsewhere) is two separate editors. Each saves its own strokes, so nothing is overwritten, but one doesn't show the other's new ink until it's reopened.
- **Thumbnails:** a few seconds after writing stops, the top of page 1 is drawn into an attachment and linked from `Item.thumbnailId` (the previous one is deleted: it's a cache, not content).
- **Pen settings** (Settings → Pen & ink, per device): hand, toolbar position, pressure curve, fingers, pen button, shape snapping, prediction, and the palm-rejection thresholds. The thresholds are starting points until the iPad report sets the defaults.

## 9. Board engine

- **Shares the canvas core** (camera, input, gestures, ink layers) with ink notes.
- **Nodes are DOM elements** inside a transformed container (one CSS matrix for the camera). Text stays real and editable, screen readers can reach it, and type stays crisp. Only nodes in or near the viewport are mounted.
- **Arrows** live on an SVG layer, anchored to node sides (straight, elbow or curved) and recomputed when nodes move.
- **Frames** are nodes that contain the nodes dropped inside their bounds.
- **Layering** uses fractional `z` keys. Snapping works to the grid and to smart guides (edges and centres of nearby nodes).
- **Export** uses a dedicated canvas renderer that paints stickies, cards, arrows and ink. It doesn't screenshot the DOM, so output is identical across browsers.
- **JSON Canvas mapping:**
  - sticky → `text` node with `color`, with our palette mapped to the six presets (red, orange, yellow, green, cyan, purple) or hex;
  - note card → `file` node (a path within an exported vault);
  - image → `file` node;
  - frame → `group` node;
  - arrow → `edge` with a label;
  - board ink → exported as an SVG `file` node.

## 10. Timeline and calendar engine

> Built in Phase 2: `features/timeline/` (scale, layout, canvas, phone feed, lane picker, saved layouts), `features/calendar/` (month, week, agenda, mini-calendar) and `features/time/` (date dialog, natural-language dates, agenda rows). Every day is the same width on the axis (days since the origin plus the fraction of that local day), so daylight-saving days don't bend it. The scale covers a window around a centre date and re-centres as you scroll. Dragging a repeat's later occurrence moves the whole series; dragging a dated checklist line rewrites its `@date`.

- **Time scale.** Zoom levels are hour, day, week, month, quarter and year. Each maps to pixels per unit and a tick generator, with labels from `Intl.DateTimeFormat`, so locale and week start come for free.
- **Queries** are range queries on the `when.start`, `due.start` or `createdAt` indexes, for the visible window plus a buffer. The plotting basis is chosen in the toolbar.
- **Placement.** Each item becomes an interval `[start, end]`; point items get a minimum width. Its lane key comes from the lane mode: group, tag, kind or colour.
- **Layout.** Greedy interval packing into rows per lane. When a unit gets too crowded for the zoom level, items collapse into a "+N" pill. Far out, lanes show density bars instead of cards.
- **Rendering.** Absolutely positioned DOM, virtualised on both axes, with sticky lane headers and time header, a today line and weekend shading. The item cards are the same components used everywhere else, at `chip` density.
- **Orientation.** The layout is axis-agnostic: lanes mode puts time on x, columns mode puts time on y.
- **Interaction:**
  - dragging snaps to the current unit, with resize handles on range ends;
  - dropping into another lane changes the item's group, with an undo toast;
  - keyboard: arrows move the selection, Alt+arrows reschedule, `+`/`-` zoom, `T` jumps to today.
- **Time semantics.** All-day dates are floating `LocalDate`s and never shift with the time zone. Timed items are stored as UTC plus their original zone, and displayed in the device's zone.
- **Calendar** month and week views use the same queries and card components. The phone feed is the columns layout with a single lane and journal-style day headers.

## 11. Search

> Built in Phase 1: `src/search/` (index, query parser) and `src/workers/search.worker.ts`. The worker re-syncs on Dexie's `storagemutated` event, so edits in any tab reach it.

- **Index:** MiniSearch in a Web Worker. Fields: title (boost 3), body text (markdown stripped), sticky text, tags (boost 2), attachment names. Later, recognised handwriting and OCR text.
- **Updates:** repositories post changes to the worker after each write. The index snapshot is persisted so startup doesn't re-index, and it's rebuilt when the schema version changes.
- **Query syntax:** free text plus filters: `tag:`, `in:<group>`, `kind:`, `colour:`, `due:<date`, `is:open`, `has:ink`. The filter chips in the UI write the same syntax, so power users can type it.

## 12. Reminders and notifications (honest limits)

> Built in Phase 2: `features/reminders/`. A timer is set for the next reminder and re-set on every data change (a Dexie live query). Reminders more than two minutes late when the app starts go to "While you were away" instead of firing. `public/sw-extras.js` is imported into the generated service worker to open the item when a notification is clicked (and to take over from v1 at once; see decision 0007). The app-icon badge counts overdue items where `setAppBadge` exists. `lib/ics.ts` writes RFC 5545 files with repeats and alarms.

A static web app can't reliably fire a notification at an exact time while it's closed:

- the Notification Triggers API never shipped;
- Periodic Background Sync is Chromium-only and can't hit a specific minute;
- iOS allows web push only for Home Screen apps, and push needs a server.

So the design is:

- **While the app is open or backgrounded:** schedule precise timers and show notifications through `ServiceWorkerRegistration.showNotification()`. `new Notification()` throws on Android Chrome.
- **On next open:** show any missed reminders in a "While you were away" list.
- **For must-not-miss items:** "Add to calendar" (.ics), so the operating system raises the alarm.
- **Wording:** "NoteDoco reminds you while it's open. Add important items to your calendar for guaranteed alerts."
- **Where supported:** the Badging API shows the overdue count on the app icon.

## 13. PWA and platform integration

- **Manifest:**
  - name, maskable PNG and SVG icons;
  - `shortcuts`: New note, New sticky, New ink note, Today;
  - `share_target` (Android and desktop Chromium only; iOS doesn't support it);
  - `file_handlers` for `.md`, `.canvas` and backup `.zip` files (Chromium desktop);
  - `launch_handler` set to focus an existing window.
- **Service worker** (Workbox via `vite-plugin-pwa`): precache the shell. Use a *prompt* update strategy ("Update ready — reload") instead of v1's auto-update, so an update never reloads the page mid-edit.
- **Floating stickies:** Document Picture-in-Picture opens an always-on-top window with the sticky dock. It works in Chromium desktop browsers and in Firefox desktop since 151 (May 2026). Elsewhere, the option falls back to the in-app dock.
- **iPad:** Scribble already turns handwriting into text in normal text fields in Safari, so typed notes and sticky text get handwriting input for free, as long as we don't block it.

## 14. Import and export formats

| Format | Direction | Notes |
|---|---|---|
| Backup `notedoco-backup-YYYY-MM-DD.zip` | Both | `manifest.json` (format, versions, counts), `data/<table>.json` (binary fields as base64), `attachments/<id>` as real files. Restore by merge (newest `updatedAt` wins; bodies follow their item) or replace. Built: `src/backup/backup.ts` |
| Markdown `.md` with YAML front matter | Both | Front matter holds id, group, tags, dates, colour; sketches exported as SVG assets |
| Plain text `.txt` | Both | — |
| PDF / SVG / PNG | Export | Ink notes: vector PDF via `pdf-lib`, one SVG, a page as PNG, and print (built: `src/canvas/export.ts`). Boards and the timeline in P5 |
| JSON Canvas `.canvas` | Both | Boards; interoperable with Obsidian (P5) |
| Obsidian-style folder (zip) | Export | Folders = groups, `.md` notes, `.canvas` boards, `assets/` (P5) |
| iCalendar `.ics` | Export | Dated items as `VEVENT`, tasks as `VTODO` |
| Google Keep (Takeout JSON), Evernote `.enex` | Import | P5 |
| NoteDoco v1 (`note-doco-db`) | Import (automatic) | See §18 |

## 15. Security and privacy

- **No third-party requests.** Fonts are self-hosted; there's no analytics and no CDN at runtime.
- **Content Security Policy** via a `<meta>` tag, since GitHub Pages can't set headers: `default-src 'self'`, no inline scripts, `blob:` and `data:` allowed only for images and media.
- **Pasted and imported HTML** goes through the editor schema (TipTap drops unknown markup). Any HTML rendered outside the editor is sanitised with DOMPurify. Imported files never execute scripts.
- **Attachments** are shown through object URLs created from stored blobs. They're never re-fetched from their source.

## 16. Performance budgets

| Metric | Budget |
|---|---|
| Initial JavaScript (gzip) | ≤ 200 KB for the shell; editor, ink, PDF and calendar load on demand |
| Cold start to interactive, mid-range phone | < 2.5 s (installed, warm: < 1 s) |
| Open a note | < 150 ms |
| Search: keystroke to results, 10k items | < 50 ms |
| Board / timeline pan and zoom | 60 fps with 1,000 nodes / 5,000 timeline items |
| Ink | See §8.5 |

CI enforces what it can: a bundle-size check on every PR, and Playwright performance traces for scripted scenarios (open a 50-page ink note, pan a 1,000-node board, scroll a 5,000-item timeline).

## 17. Testing

- **Unit:** time scale, lane packing, natural-language dates, repeat rules, markdown round-trip, stroke encoding, shape fitting, the palm-rejection state machine (pure functions with recorded pointer fixtures), repositories and migrations.
- **Component:** editors, pickers and views with Testing Library over `fake-indexeddb`.
- **End-to-end:** Playwright on Chromium, WebKit and Firefox for the core journeys: capture → organise → timeline → backup/restore → restore on a fresh profile.
- **Pen input in tests:** on Chromium, the DevTools Protocol's `Input.dispatchMouseEvent` accepts `pointerType: 'pen'` with pressure and tilt. Other engines get synthetic `PointerEvent`s.
- **Visual regression** screenshots for ink rendering, stickies and board export.
- **Accessibility:** axe-core checks in end-to-end runs, plus keyboard-only journeys.
- **Manual device matrix at each milestone:**
  - iPad + Apple Pencil (Safari, installed)
  - Android tablet + S Pen (Chrome)
  - Windows + pen (Edge/Chrome)
  - macOS/Windows with mouse and trackpad
  - iPhone and an Android phone

## 18. Migration from v1

> Live since M1 (27 Sep 2026, decision 0007): v2 is served at `/NoteDoco/`, where v1 was. The migration runs on every start. It only adds, and records the v1 ids it has brought over (`migration:v1:seen`), so nothing is added twice and a note deleted for good in v2 never comes back. A device that last opened v1 months ago still gets its notes. Installed v1 apps update in place; `/NoteDoco/next/` redirects and retires the old preview's service worker (`public/next/`).

- On first run, open `note-doco-db` if it exists (the same GitHub Pages origin and path) and read every store.
- **Mapping:**

  | v1 | v2 |
  |---|---|
  | `Project` | `Group`, colour `signal`/`verdigris`/`rust`/`graphite` → `apricot`/`mint`/`coral`/`slate` |
  | `Note` | `Item` (kind `note`) + `NoteBody` (markdown) |
  | `goalDate` | `due` (all-day) |
  | `recurrence` | an RRULE |
  | `NoteVersion` | `Version` |
  | `Attachment` | `Attachment` |
  | `AppSettings` | settings |

- **Non-destructive.** The v1 database is never modified. Migration is idempotent (v1 IDs are recorded) and writes a report shown in Settings → Data ("Migrated 42 notes, 5 projects, 3 attachments").
- **Tested** against a fixture exported from a real v1 database, including the in-memory-fallback edge case (an empty or partially written v1 database).

# NoteDoco — Product Plan v2 (fresh start)

> **Status:** Phases 0–2 built, and v2 is the live app (milestone M1, decision 0007). Phase 3 (ink) built apart from tuning on real pen devices · 1 October 2026
> **Replaces:** the v1 plan (still in git history: `git show 89b9564:PROJECT_PLAN.md`).
> **Companion docs:** [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) covers how to build it. [`docs/RESEARCH.md`](docs/RESEARCH.md) covers what other apps and the web platform taught us, with sources.

## Summary

- **What it is:** a notebook, a corkboard and a planner in one private, offline web app.
- **Capture** typed text, markdown, handwriting (stylus) or sticky notes. All of them are *items* that live in a group, can sit on boards, and have a place in time.
- **See** your items four ways: by **group**, on a **board**, on a **timeline** (with groups side by side as lanes or columns), or through **Today / Calendar / Tasks**.
- **Build order:** Foundation → Notes, stickies & groups → Time & side by side → Ink → Boards = **v2.0**. Then links, templates and onboarding (v2.1) and pen power-ups (v2.2). Sync across devices is a later, deliberate decision.
- **On "start from scratch":** yes for the app's architecture (data layer, editor, layout, timeline). No for tooling and hosting: keep the repo, stack, CI and deploy, and migrate existing data automatically. See §13.

---

## 1. The idea

You capture things however suits the moment: a typed note, a formatted markdown page, a handwritten sketch, or a quick sticky note. NoteDoco treats them all as the same kind of thing, an **item**. Every item has a home **group**, can be placed on any number of **boards**, and can have a place in **time**. So the same things can be browsed like folders, arranged like post-its on a wall, or laid out on a timeline, with "Work", "Home" and "Project X" side by side.

It stays private and fast. Everything is stored on your device, works offline, installs like an app, and exports to open formats.

### What "pseudo-organiser" means here

A paper organiser (a Filofax) keeps a diary, to-do lists, notes and a year planner in one binder. NoteDoco has the same parts, but they are views over the same items rather than separate apps:

| In a paper organiser… | …in NoteDoco |
|---|---|
| Diary and calendar pages | Today, Calendar and Timeline views |
| To-do lists | Checklists in any note or sticky, gathered in Tasks |
| Notes section | Typed, markdown and handwritten notes |
| Coloured tabs and dividers | Groups (nestable), colours, tags |
| Post-its stuck on pages | Sticky notes on boards, on Today and on the timeline |
| Year-planner wall chart | Timeline with groups side by side |

## 2. Product pillars

1. **Capture anything, fast.** Typed, markdown, ink, sticky, photo. One tap or one keystroke to start.
2. **Organise without effort.** Groups, colours, tags and boards. Nothing forces you to file first (there's an Inbox).
3. **See it in time.** Today, Timeline (groups side by side), Calendar, Tasks.
4. **Think spatially.** Boards mixing stickies, notes, handwriting and arrows.
5. **Own your data.** Local-first, offline, private, open exports, no account.

## 3. Experience principles (what "user friendly" means)

Every feature has to follow these rules:

1. **Zero-friction capture.** A new item takes one action from anywhere (`N`, the **+** button, a long-press on the app icon). It lands in the current group or the Inbox. The app never asks "where should this go?" up front.
2. **No save buttons, no lost work.** Autosave within a second, crash-safe writes, a 30-day trash, and version history.
3. **Undo instead of "Are you sure?".** Reversible actions show an **Undo** toast. Confirmation dialogs are only for things that can't be undone, such as emptying the trash.
4. **The same item everywhere.** An item looks and behaves the same in lists, boards, the timeline and the calendar: one card design with size variants. Edit it anywhere and it updates everywhere.
5. **Direct manipulation.** Drag to move, reorder, reschedule and regroup. Pinch or Ctrl/⌘-scroll to zoom anything spatial.
6. **Pen-first when there's a pen.** The pen writes and fingers pan and zoom. Tools stay within thumb reach, and there's a left-handed mode.
7. **Simple by default, powerful on demand.** Default screens stay minimal. Power features live in the command palette (Ctrl/⌘-K), right-click or long-press menus, and settings.
8. **Speed is a feature.** Notes open in under 150 ms, search updates as you type, and canvases run at 60 fps.
9. **Empty states teach.** Every empty screen says what it is for and offers the one action that fills it.
10. **Accessible and calm.** WCAG 2.2 AA, full keyboard use, reduced motion respected, colour never the only signal.

**Small touches that make it feel good** (cheap to build, and they add up):

- **Paste as stickies:** paste a list and get one sticky per line.
- Double-click an empty board to add a sticky there. Start typing on a board and a sticky appears with your text.
- Drag a sticky onto a date on the timeline to schedule it. Drag a note onto a board to make a live card.
- New notes take their title from the first line, and sticky colours cycle so a burst of ideas isn't all yellow.
- Natural-language dates everywhere: "fri 3pm", "next tuesday", "in 2 weeks".
- Paper touches: soft sticky shadows, an optional slight tilt, a peel-off animation, a dark paper option for night writing. Motion switches off under reduced-motion.
- Smooth fly-to zoom on the timeline and boards, with inertia when panning.

## 4. Who it's for

| Persona | Needs | Most-used parts |
|---|---|---|
| **Pat, the planner** | Juggles work and home. Wants to see the week and never miss a deadline. | Today, Tasks, Timeline lanes, reminders |
| **Sam, the pen-first student** | Tablet and stylus. Lecture notes, diagrams, annotated PDFs. | Ink notes, search, export to PDF |
| **Val, the visual thinker** | Brainstorms with post-its, clusters and connects ideas. | Boards, stickies wall, connectors |
| **Fin, the freelancer** | Several client projects. Meeting notes, checklists, deadlines. | Groups, markdown notes, projects side by side (fits the TimeDoco audience) |

## 5. How the pieces fit (the item model in plain words)

Everything you create is an **item** of one of four kinds:

| Kind | What it is | Typical use |
|---|---|---|
| **Note** | A typed page: formatted (markdown) or plain text. Can embed sketches, images and checklists. | Meeting notes, docs, lists |
| **Ink note** | Handwritten pages on paper templates, with optional typed text boxes and images. | Lecture notes, journaling, sketches |
| **Sticky** | A small coloured square, typed or handwritten, optionally a mini checklist. | Ideas, reminders, quick to-dos |
| **Board** | An infinite canvas holding stickies, note cards, images, handwriting and arrows. | Brainstorms, plans, kanban, mood boards |

Every item has:

- a **home group**, or the **Inbox** if unfiled;
- **tags**, a **colour**, and **pinned** / **archived** flags;
- optional **time**: *when* (a day, a time or a date range: its place on the timeline), a *due* date, *reminders* and *repeat* rules;
- automatic *created* and *edited* times.

An item can appear on **many boards**; it is the same item, not a copy. The timeline can plot items by *when*, *due* or *created*. Undated items can be shown at their creation date, so the timeline is useful from day one instead of empty.

**Glossary:** *group* = folder/notebook/project. *Board* = spatial canvas. *Lane* = one row (or column) of the timeline, usually one group. *Pane* = one side of a split screen. *Sticky dock* = a tray of pinned stickies you can open from any screen. *Inbox* = where unfiled captures wait.

## 6. Feature catalogue

**When** column: **P0–P4** = v2.0 (built in that roadmap phase), **P5** = v2.1, **P6** = v2.2, **Later** = backlog (needs research or a decision). IDs are referenced by the roadmap in §9.

### 6.1 Capture

| ID | Feature | When |
|---|---|---|
| CAP-1 | **New** button plus shortcuts: `N` note, `S` sticky, `D` ink note (P3). `B` (board) arrives with boards in P4. | P1 |
| CAP-2 | Quick-capture bar: type one line and it becomes a sticky or note, with natural-language dates applied ("call Sam fri 3pm") | P2 |
| CAP-3 | Inbox for unfiled captures, with fast triage (move, tag, date) by keyboard or drag | P1 |
| CAP-4 | Paste or drag-drop anywhere: text, images, links and files become items or attachments | P1 |
| CAP-5 | App-icon shortcuts on Android and desktop: New note, New sticky; New ink note and Today once those exist | P1 |
| CAP-6 | Share into NoteDoco from other apps (Android and desktop only; iOS doesn't support it for web apps) | P5 |
| CAP-7 | Camera: snap a photo into a note on mobile | P5 |
| CAP-8 | Voice memo attached to a note | Later |
| CAP-9 | Start from a template: meeting, daily page, weekly review, Cornell, kanban, etc. | P5 |
| CAP-10 | Photograph a wall of real post-its and turn each one into a digital sticky | Later (spike) |

### 6.2 Notes: text and markdown

| ID | Feature | When |
|---|---|---|
| NOTE-1 | WYSIWYG markdown editor: type shortcuts (`#`, `-`, `[ ]`, `>`, `**`) or use the toolbar. Saved as plain Markdown. | P1 |
| NOTE-2 | Plain-text notes: no formatting interpretation, monospace option | P1 |
| NOTE-3 | Source mode: edit the raw markdown | P1 |
| NOTE-4 | Slash menu (`/`): heading, checklist, table, code, quote, callout, divider, image, sketch, date | P1 |
| NOTE-5 | Nested checklists. Tick items from anywhere (lists, Today, Tasks); progress shows on cards. | P1 |
| NOTE-6 | Tables, code blocks with syntax highlighting, callouts | P1 |
| NOTE-7 | Inline images (paste or drop, resizable) and an attachments list | P1 |
| NOTE-8 | Inline sketch block: draw inside a typed note with the pen | P3 |
| NOTE-9 | Date chips: type `@fri` or `@2026-10-03`. Dated checklist items show on Today, Timeline and Tasks. | P2 |
| NOTE-10 | `[[Wikilinks]]` with autocomplete, backlinks and hover previews | P5 |
| NOTE-11 | Outline / table of contents, word count | P5 |
| NOTE-12 | Focus mode (P1); typewriter scrolling (P5) | P1 / P5 |
| NOTE-13 | Find and replace within a note | P1 |
| NOTE-14 | Maths (KaTeX) and diagrams (Mermaid), loaded only when used | Later |
| NOTE-15 | Mobile formatting bar above the keyboard. iPad Scribble (handwriting into text fields) keeps working. | P1 |
| NOTE-16 | Conversions: text ⇄ markdown, note → stickies (one per bullet), selection → sticky | P5 |

### 6.3 Ink: stylus drawing and handwriting

| ID | Feature | When |
|---|---|---|
| INK-1 | Pressure-sensitive pens (ballpoint, fountain, marker) with smooth, low-latency strokes | P3 |
| INK-2 | Highlighter that sits behind ink and never covers it | P3 |
| INK-3 | Eraser: whole-stroke and precise (partial), an "erase highlighter only" option, and the pen's eraser end or button works | P3 |
| INK-4 | Palm rejection: the pen draws, fingers pan and zoom. "Draw with finger" toggle; the mouse draws on desktop. | P3 |
| INK-5 | Favourites bar (3–6 quick pens), colour and size presets, custom colours | P3 |
| INK-6 | Lasso: select, then move, resize, rotate, recolour, change thickness, duplicate, copy/paste or delete | P3 |
| INK-7 | Undo/redo: buttons, Ctrl/⌘-Z, two-finger tap = undo, three-finger tap = redo | P3 |
| INK-8 | Paged ink notes: A4, Letter or endless scroll. Templates: blank, lined, grid, dot, Cornell, planner. Paper colours including dark. | P3 |
| INK-9 | A page is added automatically when you write near the end. Page thumbnails; reorder, duplicate or delete pages. | P3 |
| INK-10 | Pinch or Ctrl-scroll zoom and pan; strokes stay crisp at any zoom | P3 |
| INK-11 | Shape snapping: draw and hold to get a clean line, rectangle, ellipse, triangle or arrow | P3 |
| INK-12 | Scratch out strokes to erase them without switching tools (opt-in) | P6 |
| INK-13 | Circle strokes to select them without switching tools (opt-in) | P6 |
| INK-14 | Typed text boxes and images on ink pages | P3 |
| INK-15 | Ruler / straight-edge | P6 |
| INK-16 | Hover preview of the pen tip, where the device reports hover | P6 |
| INK-17 | Export to PDF (vector), SVG and PNG; print | P3 |
| INK-18 | Handwriting search and convert-to-text (on-device recognition, where available) | Later (spike) |
| INK-19 | Import a PDF and write on it (slides, forms); export the annotated PDF | P6 |
| INK-20 | Replay: a time-lapse of how a page was written | Later |
| INK-21 | Tape tool: hide answers and tap to reveal, for studying | Later |
| INK-22 | Audio recording synced to ink: tap a word to hear that moment | Later |
| INK-23 | Left-handed mode; toolbar at the top, side or floating | P3 |
| INK-24 | Tidy and reflow handwriting | Later |

### 6.4 Sticky notes

| ID | Feature | When |
|---|---|---|
| STK-1 | Stickies in 8 colours and 3 sizes (free resize on boards), with lightly formatted text | P1 |
| STK-2 | Handwritten stickies (ink inside a sticky) | P4 |
| STK-3 | Checklist stickies (mini to-do lists) | P1 |
| STK-4 | Stickies wall: every sticky across groups in a grid, filterable by colour, group, tag or date | P1 |
| STK-5 | Colour meanings: your own legend (e.g. yellow = idea, pink = urgent), usable as filters | P1 |
| STK-6 | Stickies everywhere: on Today and the timeline (P2); stuck to a note's margin (P5) | P2 / P5 |
| STK-7 | Sticky dock: pinned stickies in a tray you can open from any screen | P1 |
| STK-8 | Floating stickies over other apps on desktop (Chrome, Edge and Firefox desktop; not Safari or mobile) | P5 |
| STK-9 | Stack stickies into a pile, fan them out, auto-arrange (grid, by colour, by date) | P4 |
| STK-10 | Promote a sticky to a full note (it stays linked); merge several stickies into one note | P1 |
| STK-11 | Due dates and reminders on stickies | P2 |
| STK-12 | Paper feel: soft shadow, optional tilt ("tidy" toggle), optional handwriting-style font, peel animation | P1 |

### 6.5 Boards (spatial canvas)

| ID | Feature | When |
|---|---|---|
| BRD-1 | Infinite board with pan and zoom; plain, dot, grid or cork background | P4 |
| BRD-2 | Place stickies, live note cards (any note), images and text labels | P4 |
| BRD-3 | The same item on many boards; edit it anywhere and it updates everywhere | P4 |
| BRD-4 | Select, multi-select (marquee, Shift), align and distribute, snap to grid, smart guides | P4 |
| BRD-5 | Labelled arrows between items that follow the items when moved | P4 |
| BRD-6 | Frames: named areas such as "To do / Doing / Done" or "Urgent / Important" | P4 |
| BRD-7 | Handwriting and drawing on boards, around and between cards | P4 |
| BRD-8 | Board templates: kanban, Eisenhower matrix, weekly plan, retro, SWOT, mind map, mood board | P5 |
| BRD-9 | Every group can have its own corkboard | P4 |
| BRD-10 | Minimap, zoom to fit, saved viewpoints ("scenes") and present mode | P5 |
| BRD-11 | Export as PNG/PDF (P4); JSON Canvas import/export, compatible with Obsidian (P5) | P4 / P5 |

### 6.6 Groups and organisation

| ID | Feature | When |
|---|---|---|
| GRP-1 | Groups (notebooks/projects): nesting, colour, emoji, description | P1 |
| GRP-2 | Sidebar tree: drag to reorder and nest; drop items onto a group to move them | P1 |
| GRP-3 | Per-group views: List, Cards (P1); Timeline, Calendar (P2); Board (P4). Each group remembers its last view. | P1–P4 |
| GRP-4 | Tags (`#tag` inline or a picker), tag browser, rename and merge tags | P1 |
| GRP-5 | Pin, favourites, archive (hidden but restorable) | P1 |
| GRP-6 | Sort by manual order, edited, created, title or due. Group by kind, colour or date. | P1 |
| GRP-7 | Smart groups (saved searches, e.g. "pink stickies due this week") | P5 |
| GRP-8 | Multi-select and bulk actions: move, tag, colour, date, archive, delete, export | P1 |
| GRP-9 | Covers for ink notebooks (a visual notebook shelf) | P6 |
| GRP-10 | Group templates (e.g. "Project" = board + notes + timeline lane) | P5 |
| GRP-11 | **Groups side by side:** pick 2–4 groups and see them as columns of cards; drag between columns to move items | P2 |

### 6.7 Time and organiser

| ID | Feature | When |
|---|---|---|
| TIME-1 | Dates on any item: a day, a time or a range; due dates; natural-language entry | P2 |
| TIME-2 | **Today** (home screen): today's agenda, due and overdue, pinned stickies, today's page (typed or handwritten), quick capture, recent items | P2 |
| TIME-3 | **Timeline, lanes mode:** time runs left to right and each group is a lane. Choose, reorder and collapse lanes; lanes can also be tags, kinds or colours. | P2 |
| TIME-4 | **Timeline, columns mode:** groups are columns and time runs down, for comparing groups day by day | P2 |
| TIME-5 | Zoom from hours to years. Far out, items become compact chips, dots and density bars. | P2 |
| TIME-6 | Drag to reschedule, drag range ends, drag across lanes to change group (with undo), click an empty slot to create an item there | P2 |
| TIME-7 | Show undated items at their created or edited date (toggle) | P2 |
| TIME-8 | Jump to today or any date; today line; shaded weekends; sticky headers; overview scrubber | P2 |
| TIME-9 | Saved timeline layouts (lanes + zoom + filters) | P2 |
| TIME-10 | Phone timeline: a vertical, journal-style feed with lane filter chips; swipe between lanes | P2 |
| TIME-11 | Calendar: month, week (with a time grid) and agenda; mini-calendar with dots in the sidebar | P2 |
| TIME-12 | **Tasks:** every open checklist item and to-do sticky across groups, by date or group | P2 |
| TIME-13 | Reminders: in-app and system notifications while the app is open, catch-up of missed reminders on next open, honest wording about limits | P2 |
| TIME-14 | "Add to calendar" (.ics) per item and for all dated items, so the phone's calendar can raise alarms | P2 |
| TIME-15 | Repeats (daily, weekdays, weekly on chosen days, monthly, yearly); repeating checklists reset; repeating template notes (e.g. weekly review) | P2 |
| TIME-16 | "On this day": items from this date in previous years | P5 |
| TIME-17 | Weekly review flow: done, slipped, next week | P5 |
| TIME-18 | Planner notebooks: auto-generated, linked year/month/week/day ink pages | Later |
| TIME-19 | Timeline dependencies (arrows) and milestones | Later |
| TIME-20 | Export the timeline as PNG/PDF | P5 |

### 6.8 Find and connect

| ID | Feature | When |
|---|---|---|
| FIND-1 | Instant, typo-tolerant search across titles, text, stickies, tags and attachment names | P1 |
| FIND-2 | Filters: kind, group, tag, colour, date range, has ink, has image, open or done | P1 |
| FIND-3 | Command palette (Ctrl/⌘-K): go anywhere, run any action | P1 |
| FIND-4 | Recent items ("jump back in") | P1 |
| FIND-5 | Backlinks and hover previews (with NOTE-10) | P5 |
| FIND-6 | Search inside handwriting (recognised text) and images (OCR) | Later |
| FIND-7 | Search inside imported PDFs | P6 |

### 6.9 Workspace: side by side

| ID | Feature | When |
|---|---|---|
| WS-1 | Split view: 2 panes on tablet and desktop, up to 4 on wide screens; any view in any pane | P2 |
| WS-2 | Drag items between panes: move to a group, place on a board, drop on a date | P2 |
| WS-3 | Open in a new pane (Shift-click or menu); back/forward per pane | P2 |
| WS-4 | Saved workspaces (e.g. "Planning" = timeline + board) | P5 |
| WS-5 | Inspector panel (properties, backlinks, history) that can be toggled | P2 |

### 6.10 Data safety and ownership

| ID | Feature | When |
|---|---|---|
| SAFE-1 | Local-first storage; works fully offline; installable | P0 |
| SAFE-2 | Ask the browser to keep data permanently; storage meter; warning when space is low | P0 |
| SAFE-3 | iPhone/iPad: guide users to "Add to Home Screen", because Safari deletes data of sites not used for 7 days | P0 |
| SAFE-4 | Trash (30 days) with restore; archive | P1 |
| SAFE-5 | Version history per item: time-travel slider, compare, restore. Notes in P1, ink and boards in P5. | P1 / P5 |
| SAFE-6 | Full backup to one `.zip` (data + attachments), restore or merge, backup reminders | P1 |
| SAFE-7 | Automatic backups to a folder you choose (Chrome and Edge desktop) | P5 |
| SAFE-8 | Export: Markdown/.txt (P1); ink → PDF/SVG/PNG (P3); dated items → .ics (P2); whole library → Obsidian-style folder of `.md` + `.canvas` + assets (P5) | P1–P5 |
| SAFE-9 | Import: NoteDoco v1 data (automatic) and Markdown files/folders (P1); JSON Canvas, Google Keep, Evernote (P5) | P1 / P5 |
| SAFE-10 | App lock (PIN or passphrase) and encrypted items | Later |
| SAFE-11 | Sync across devices | Later (decision gate, §10) |

### 6.11 Personalisation and accessibility

| ID | Feature | When |
|---|---|---|
| UX-1 | Light, dark and system themes (dark stays the default, as in v1); accent colour | P0 |
| UX-2 | Text size; comfortable or compact density; font choices (sans, serif, mono; handwriting-style for stickies) | P1 |
| UX-3 | Keyboard shortcuts everywhere plus a cheat sheet on `?` (P1); custom shortcuts (P5) | P1 / P5 |
| UX-4 | Full keyboard and screen-reader support, alt text for images and sketches, reduced motion | Every phase |
| UX-5 | Locale-aware dates and a choice of week start (P1); translations (Later) | P1 / Later |
| UX-6 | Onboarding: choose what you'll use NoteDoco for, get sample groups and a "Welcome" board that teaches by example, plus contextual tips | P5 |
| UX-7 | "What's new" panel; a prompt when an update is ready (never a reload mid-edit) | P0 |

### 6.12 Integrations

| ID | Feature | When |
|---|---|---|
| INT-1 | TimeDoco link, as today | P1 |
| INT-2 | TimeDoco bridge: time spent per item or group | Later (confirm it's still wanted) |

## 7. Signature features (why it's awesome)

1. **Everything on one timeline.** Typed notes, handwriting and stickies together, groups side by side, zoom from hours to years.
2. **Boards where everything mixes.** Stickies, live note cards and handwriting on one canvas, and the same note can live on many boards.
3. **Pen-first ink in the browser.** Pressure, palm rejection, lasso and shape snapping, with gestures to follow.
4. **Sticky notes everywhere.** On boards, on Today, on the timeline, and floating over other apps on desktop.
5. **A notes app that runs your day.** Today, Tasks, Calendar and reminders are built from your notes rather than bolted on.
6. **Private and portable.** No account, no server, open formats in and out.

## 8. Screens and navigation

### 8.1 Layout

Desktop and tablet, with two panes open:

```
┌──────────────┬───────────────────────────────┬───────────────────────────────┐
│ + New        │ Timeline            ◀ Today ▶ │ Board: Launch plan            │
│              │        Mon 5  Tue 6  Wed 7 …  │  ┌────┐ ┌────┐   ┌─────────┐  │
│ Today        │ Work   [Standup] [■ call Sam] │  │idea│ │idea│──▶│ Spec    │  │
│ Inbox (3)    │ Home        [✎ kitchen]       │  └────┘ └────┘   │ (note)  │  │
│ Timeline     │ Launch [═══ Beta testing ═══] │   ✎ handwriting  └─────────┘  │
│ Calendar     │                               │                               │
│ Tasks        │                               │                               │
│ Stickies     │                               │                               │
│ ──────────── │                               │                               │
│ GROUPS       │                               │                               │
│ ● Work       │                               │                               │
│   ● Launch   │                               │                               │
│ ● Home       │                               │                               │
│ ──────────── │                               │                               │
│ Tags · Trash │                               │                               │
│ Settings     │ [▴ sticky dock]               │                               │
└──────────────┴───────────────────────────────┴───────────────────────────────┘
```

On a phone, there's one pane and a bottom bar: **Today · Groups · (+) · Timeline · Search**. The sidebar becomes a drawer. List rows support swipe actions (done/pin, trash) and long-press menus.

### 8.2 Timeline: groups side by side

Lanes mode (time runs across):

```
           Mon 5      Tue 6      Wed 7 │today  Thu 8      Fri 9      Sat 10 ░░
 Work   ▸  [Standup notes]          [■ call Sam]     [═══ Sprint 12 ════════ ░░
 Home   ▸             [✎ kitchen sketch]             [☐ groceries 2/5]      ░░
 Launch ▸  [══════════ Beta testing ══════════]      ◆ release              ░░
```

Columns mode (time runs down):

```
             Work               Home                Launch
 Mon 5    [Standup notes]                          ┌ Beta testing
 Tue 6                        [✎ kitchen sketch]   │
 Wed 7 ── today ───────────────────────────────────┼──────────────
 Thu 8    [■ call Sam]                             └
 Fri 9    ┌ Sprint 12         [☐ groceries 2/5]    ◆ release
```

Toolbar: plot by **When / Due / Created**, zoom, lane picker, lanes/columns switch, filters, **Today**, and saved layouts.

### 8.3 Key screens

- **Today:** date and a week strip; now/next agenda; all-day and due-today items; overdue (collapsible); pinned stickies; "Today's page" (typed or handwritten); quick capture; recently edited.
- **Group:** header with a view switcher (List · Cards · Board · Timeline · Calendar), filter chips and a **+ New** menu.
- **Note editor:** title, a collapsible properties row (group, tags, date, colour), the body, and the optional inspector.
- **Ink editor:** toolbar (favourites, tools, colours, sizes, undo/redo, zoom, page menu) and the page canvas; mirrored in left-handed mode.
- **Board:** the canvas, a bottom tool strip (select, sticky, note card, text, image, pen, arrow, frame) and zoom controls.
- **Stickies wall:** a grid of stickies with colour, group and tag filters, drag to reorder, and "Paste as stickies".
- **Timeline** and **Calendar** (month/week/agenda), as in §8.2.
- **Tasks:** grouped as Overdue / Today / Upcoming / No date, with filters.
- **Search:** results with kind icons and highlighted snippets, filters, saved searches.
- **Settings:** Appearance · Pen & ink · Dates & reminders · Data & backup (storage status, backup/restore, import/export, migration report) · Shortcuts · About.

## 9. Roadmap

Sizes: **S** = one small PR, **M** = a few PRs, **L** = several PRs (split it before starting). Every task must also meet the Definition of Done in §14. Tasks are written so each one can be handed to a person or an AI coding agent as a self-contained unit.

### Phase 0 — Foundation and risk spikes

> **Status (26 Sep 2026):** built.
> - **Done:** P0.1–P0.6 and P0.8 (see `docs/decisions/` and `docs/spikes/P0.8-markdown-roundtrip.md`).
> - **P0.7:** the ink lab is built and passes automated pen tests, but is **waiting for real-device results** before decision 0004 is accepted (`docs/spikes/P0.7-ink-lab.md`).
> - **Extra, pulled forward from P1.1:** creating, colouring and trashing groups, with undo, so the data layer is exercised end to end.

No user-facing features yet. The goal is a solid base, and early answers to the two riskiest questions: can ink feel good in a browser, and can the editor keep markdown intact?

| ID | Task | Size | Done when |
|---|---|---|---|
| P0.1 | Decision records (ADRs) for the choices in §10 and `docs/ARCHITECTURE.md` §2 | S | ADRs merged under `docs/decisions/` |
| P0.2 | Fresh scaffold in `app/` (deployed at `/NoteDoco/next/` beside v1, decision 0002): Vite, React 19, strict TypeScript, Tailwind v4, oxlint, Vitest, Playwright; feature-folder layout; `AGENTS.md` with conventions; a real README | M | CI runs lint, typecheck, unit tests and an e2e smoke test on every PR |
| P0.3 | Design system: tokens (UI palette + 8-colour content palette for light and dark), type scale, spacing, motion; accessible primitives; light/dark/system theming (UX-1); a `/dev` gallery page | L | Every primitive works by keyboard and passes contrast checks in both themes |
| P0.4 | Data layer: schema, repositories, live queries, migrations, sortable IDs, manual ordering, soft delete, undo stack | L | CRUD, undo and migration tests pass. If storage fails, the app says so; it never silently keeps data only in memory. |
| P0.5 | App shell: sidebar, drawer, bottom bar; pane-based layout (one pane for now) with state in the URL; command palette skeleton; toasts; theming; error boundary | M | Works at 360 px, 768 px and 1280 px+ |
| P0.6 | PWA and durability: manifest with shortcuts, update prompt, persistent-storage request, storage meter, iOS "Add to Home Screen" guide (SAFE-1–3, UX-7) | M | Installable on iOS, Android and desktop; storage status shown in Settings |
| P0.7 | **Spike:** ink latency and palm-rejection prototype on iPad (Safari), Android (Chrome) and Windows (Edge/Chrome) | M | Report with measured results and a go/no-go on the custom ink engine |
| P0.8 | **Spike:** markdown round-trip with the chosen editor on a test corpus (tables, task lists, nesting, code) | S | Round-trip report; editor choice confirmed or switched to the fallback |

### Phase 1 — Notes, stickies and groups → Milestone M1 "replaces v1"

> **Status (26 Sep 2026):** all P1 tasks built and tested:
> - 109 unit tests and 28 end-to-end tests, including accessibility scans of every screen in both themes and a phone-overflow check;
> - startup JavaScript 160 KB gzipped.
>
> The M1 demo below works end to end. **Switched on 27 Sep 2026:** v2 moved to the root and replaced v1 at `/NoteDoco/` (decision 0007); `/NoteDoco/next/` now redirects.
>
> Changes from the plan:
> - source mode is a plain text area rather than CodeMirror (smaller, and iPad Scribble works in it);
> - drag and drop uses the browser's own API with menu alternatives, rather than a library.

| ID | Task | Features | Size |
|---|---|---|---|
| P1.1 | Groups: create, rename, colour, emoji, nest, drag-reorder, archive, trash | GRP-1, 2, 5 | M |
| P1.2 | Items core: create, move, pin, archive, trash, restore; Inbox; undo toasts; multi-select and bulk actions | CAP-3, GRP-8, SAFE-4 | M |
| P1.3 | Note editor: WYSIWYG markdown, slash menu, checklists, tables, code, links, images; plain-text and source modes; find and replace; focus mode; autosave | NOTE-1–7, 12, 13, 15 | L |
| P1.4 | Stickies v1: colours, sizes, checklist stickies, colour legend, stickies wall, sticky dock, promote to note | STK-1, 3, 4, 5, 7, 10, 12 | M |
| P1.5 | Group views: List and Cards with previews and checklist progress; sorting and grouping; empty states | GRP-3, GRP-6 | M |
| P1.6 | Tags: inline `#tags`, picker, browser, rename and merge | GRP-4 | S |
| P1.7 | Search and command palette: background index, filters, recent items | FIND-1–4 | M |
| P1.8 | Note version history; trash auto-purge after 30 days | SAFE-4, 5 | M |
| P1.9 | Backup and restore (.zip), export .md/.txt, import Markdown, backup reminders | SAFE-6, 8, 9 | M |
| P1.10 | Automatic, non-destructive migration of v1 data | SAFE-9 | M |
| P1.11 | Capture: + button, `N`/`S` shortcuts, app-icon shortcuts, paste/drop to create | CAP-1, 4, 5 | S |
| P1.12 | Settings and personalisation: text size, density, fonts, date formats, week start, shortcut cheat sheet, TimeDoco link | UX-2, 3, 5, INT-1 | S |

**M1 demo:** create nested groups; write markdown and plain notes with images and checklists; make a wall of coloured stickies; find anything in under a second; move, tag, trash and undo; back up and restore; after upgrading, existing v1 notes are all there. **Then switch the live site to v2** (done 27 Sep 2026).

### Phase 2 — Time and side by side → Milestone M2 "it's my organiser"

> **Status (27 Sep 2026):** all P2 tasks built and tested:
> - 157 unit tests and 41 end-to-end tests (desktop and phone), with accessibility scans and a phone-overflow check covering Today, Tasks, the timeline, the calendar and the columns view;
> - startup JavaScript 170 KB gzipped (natural-language dates, the timeline and the calendar all load on first use);
> - database version 2 indexes repeating items and every checklist line (with its @date).
>
> The M2 demo below works end to end. Reminders and phone layouts still need a check on real devices.
>
> Changes from the plan:
> - repeats use a small built-in RRULE subset (daily, weekly on chosen days, monthly, yearly, interval, until) instead of the `rrule` library; monthly and yearly repeats keep to the last day of short months;
> - a repeat can be a template ("start a fresh copy each time") as well as an item that moves on when done;
> - the timeline draws only the visible stretch plus a screen either side, with its own windowing rather than TanStack Virtual;
> - calendar dragging works with a mouse or pen; on touch, you change dates in the date dialog;
> - the inspector belongs to the item page rather than being a global panel;
> - a checklist line's date lives in its text (`@2026-10-02`), so moving the line on the timeline or calendar rewrites that text.

| ID | Task | Features | Size |
|---|---|---|---|
| P2.1 | Time model: when/due/reminders/repeats on items; natural-language date input; `@date` chips; dated checklist items | TIME-1, NOTE-9, CAP-2 | M |
| P2.2 | Today view | TIME-2, STK-6 | M |
| P2.3 | Timeline engine: time scale, zoom levels, virtualisation, lane packing, clustering, today line, jump to date | TIME-5, 8 | L |
| P2.4 | Timeline views: lanes by group, tag, kind or colour; lane picker; lanes and columns modes; saved layouts; undated-by-created toggle | TIME-3, 4, 7, 9 | L |
| P2.5 | Timeline editing: drag to reschedule and resize, drag across lanes, click to create, keyboard control, undo | TIME-6, STK-11 | M |
| P2.6 | Phone timeline feed | TIME-10 | M |
| P2.7 | Calendar: month, week, agenda; drag to reschedule; sidebar mini-calendar | TIME-11 | L |
| P2.8 | Tasks view | TIME-12 | M |
| P2.9 | Reminders and notifications, missed-reminder catch-up, .ics export | TIME-13, 14 | M |
| P2.10 | Repeats: rules, repeating checklists, repeating template notes | TIME-15 | M |
| P2.11 | Side by side: split panes, drag between panes, open in pane, inspector, groups-as-columns view | WS-1, 2, 3, 5, GRP-11 | L |

**M2 demo:** plan a week. Dated notes and stickies show on Today, the timeline and the calendar. Compare Work and Home lanes side by side, drag an item to Thursday, get a reminder, and add an item to the phone's calendar.

### Phase 3 — Ink → Milestone M3 "writing feels great"

> **Status (1 Oct 2026):** P3.1–P3.10 built and tested, except what needs real pen hardware:
> - 212 unit tests and 55 end-to-end tests, including pen and touch input sent through the browser's DevTools protocol (pressure, the eraser, lasso, shape snapping, pinch, palm-sized touches);
> - startup JavaScript 174 KB gzipped (the ink editor, sketch previews and the PDF exporter all load on first use);
> - database version 3 adds `inkElements` (text boxes and images on pages).
>
> **Waiting for the iPad ink-lab report (decision 0004):** default palm-rejection thresholds, prediction and low-latency canvas defaults, the performance pass (tiled dry ink for very full pages), and the M3 demo on real devices. The thresholds are already adjustable in Settings → Pen & ink.
>
> Changes from the plan:
> - the toolbar can sit at the top, the side (on wider screens) or the bottom; a floating toolbar is left for later;
> - left-handed mode moves the zoom bar and the side toolbar away from the writing hand;
> - a second finger always turns a one-finger stroke into a pan or pinch (the stroke is dropped), so fingers can draw and still zoom;
> - text boxes and images sit under the ink, so you can write on them;
> - sketches open in a full-screen editor from a live preview in the note, rather than being drawn inline;
> - PDF export keeps Western text as real text; text the standard PDF font can't write (emoji, CJK) is drawn as a picture of the text box;
> - dry ink is redrawn from vectors on each camera move instead of being tiled; tiling waits for the performance pass on real devices.

| ID | Task | Features | Size |
|---|---|---|---|
| P3.1 | Canvas core, shared with boards: camera (pan/zoom/inertia), coordinate spaces, layered rendering, high-DPI screens | INK-10 | L |
| P3.2 | Input: full-rate pen samples, prediction, palm rejection, pen eraser/barrel buttons, finger pan/zoom, 2- and 3-finger taps | INK-4, 7 | L |
| P3.3 | Strokes: pressure-based rendering, pen types, highlighter layer, compact storage, spatial index | INK-1, 2 | L |
| P3.4 | Tools: favourites bar, colour and size, eraser (stroke and precise), lasso with transform handles, copy/paste | INK-3, 5, 6 | L |
| P3.5 | Ink notes: pages, paper sizes and templates, auto-add page, page sorter, autosave, undo/redo | INK-8, 9 | L |
| P3.6 | Shape snapping | INK-11 | M |
| P3.7 | Text boxes and images on ink pages | INK-14 | M |
| P3.8 | Inline sketch block in typed notes | NOTE-8 | M |
| P3.9 | Export PDF/SVG/PNG and print; thumbnails for cards and the timeline | INK-17 | M |
| P3.10 | Pen settings (left-handed, toolbar position, pressure curve, finger drawing); performance pass; automated pen tests | INK-23 | M |

**M3 demo:** on an iPad (Safari, installed) and on a Windows or Android pen device, write a full page without stray palm marks; lasso and move a paragraph; snap a rectangle; export a PDF; sketch inside a markdown note. Ink notes appear as thumbnails on the timeline.

### Phase 4 — Boards → Milestone M4 = **v2.0 release**

| ID | Task | Features | Size |
|---|---|---|---|
| P4.1 | Board canvas on the shared core: cards as real, editable elements; select, marquee, transform; snapping and guides; layering; clipboard | BRD-1, 4 | L |
| P4.2 | Board contents: stickies, live note cards, images, text labels; the same item on many boards | BRD-2, 3 | M |
| P4.3 | Labelled arrows | BRD-5 | M |
| P4.4 | Frames; stacks and fan-out; auto-arrange | BRD-6, STK-9 | M |
| P4.5 | Handwriting on boards; handwritten stickies | BRD-7, STK-2 | M |
| P4.6 | Group corkboards and the Board view in groups | BRD-9, GRP-3 | S |
| P4.7 | Board export PNG/PDF | BRD-11 | S |
| P4.8 | v2.0 hardening: device-matrix pass, accessibility audit, performance budgets, user docs | — | M |

**M4 demo:** run a brainstorm. Capture 30 stickies, cluster them by colour, connect them with arrows, draw around them, turn one into a note, and see the dated ones on the timeline.

### Phase 5 — Connect and polish → v2.1

- Wikilinks, backlinks and hover previews (NOTE-10, FIND-5)
- Smart groups and search syntax (GRP-7)
- Templates and a template gallery, including board and group templates (CAP-9, BRD-8, GRP-10)
- Onboarding with a teaching "Welcome" board; custom shortcuts (UX-6, UX-3)
- Saved workspaces (WS-4)
- Floating stickies window; stickies stuck to notes (STK-8, STK-6)
- Obsidian-style export, JSON Canvas import/export, Google Keep and Evernote import (SAFE-8, SAFE-9, BRD-11)
- Version history for ink and boards (SAFE-5)
- Minimap and scenes; On this day; weekly review; timeline export (BRD-10, TIME-16, 17, 20)
- Share into NoteDoco, camera capture, automatic folder backups (CAP-6, 7, SAFE-7)
- Outline, typewriter mode, conversions (NOTE-11, 12, 16)

### Phase 6 — Pen power-ups → v2.2

- PDF import and annotation; search inside PDFs (INK-19, FIND-7)
- Modeless gestures (scratch-out, circle-to-select), ruler, hover preview (INK-12, 13, 15, 16)
- Notebook covers (GRP-9)
- Spike: on-device handwriting recognition, to unlock INK-18 and FIND-6

### Later / backlog (needs research or a decision)

Handwriting recognition and OCR (INK-18, FIND-6) · audio synced to ink, replay, tape tool (CAP-8, INK-20–22) · tidy/reflow handwriting (INK-24) · planner notebooks (TIME-18) · timeline dependencies (TIME-19) · maths and diagram blocks (NOTE-14) · photographing real post-its (CAP-10) · app lock and encryption (SAFE-10) · **sync across devices** (SAFE-11) · TimeDoco bridge (INT-2) · translations (UX-5).

## 10. Decisions to confirm

The recommended answer is what the plan assumes. Changing D1 or D2 changes the architecture, so settle them before Phase 1.

| # | Question | Recommendation | Why |
|---|---|---|---|
| D1 | Is one device OK for v2.0 (moving data by backup/restore), with sync later? | **Yes.** Build the data model sync-ready now and decide in a later phase. | Sync is the biggest cost and privacy decision in a local-first app. If phone + tablet + desktop sync is a must from day one, the approach has to be chosen before Phase 1. |
| D2 | Web app (PWA) only? | **Yes.** Consider native wrappers later (App Store presence, stronger storage guarantees). | Keeps one codebase and the GitHub Pages hosting. The browser now supports what the ink engine needs. |
| D3 | Which stylus devices matter most? | **iPad + Apple Pencil** (installed to Home Screen) as the primary target, plus one Windows or Android pen device | Each platform behaves differently; the ink spike needs real devices. |
| D4 | One home group per item, or items in many groups? | **One home group**, with tags and boards for multi-placement | Simple mental model; boards already allow "in many places". |
| D5 | Keep the Doco look (dark default, IBM Plex, amber/teal/rust)? | **Yes, but add an 8-colour sticky/group palette.** v1's "no new colours" rule can't hold for post-its. | Keeps the brand while making stickies and groups readable. |
| D6 | Handwriting recognition: on-device only, or an opt-in cloud service? | **On-device only.** Revisit later. | Privacy-first; browser support is limited today (see `docs/RESEARCH.md`). |
| D7 | Is the TimeDoco bridge still a goal? | Keep the link; **park the bridge until after v2.0**. | Not part of the new brief. |
| D8 | Does anyone use the current deployed app? | Assume yes, and **migrate v1 data automatically** (P1.10). | Cheap insurance. |
| D9 | How to switch from v1 to v2? | **Changed:** build v2 in `app/` on `main` and preview it at `/NoteDoco/next/`; switch at M1 (decision 0002). | v1 keeps working, and v2 can be tried on real devices from day one. |

## 11. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Ink feels laggier in the browser than in native apps, especially on iPad | Early spike (P0.7); full-rate and predicted pen samples (Safari 18.2+, Chromium, Firefox); a tiny render path for the active stroke; Chromium low-latency extras where available; native wrapper as a fallback if the spike says no-go |
| iOS Safari deletes data for sites not used for 7 days | Home Screen install prompt, persistent-storage request, backup reminders, one-click export |
| Scope: this is a notes app, a whiteboard and a planner in one | One item model, one card component, one canvas core shared by ink and boards; strict phase gates; P5+ features stay out until v2.0 ships |
| Reminders can't fire reliably when a web app is closed | Say so honestly in the UI; catch up on open; .ics export hands alarms to the phone's calendar; true push only if a sync server ever exists |
| Large ink notes and boards get slow | Tiled rendering, spatial indexing, virtualisation, performance budgets checked in CI |
| The WYSIWYG editor rewrites users' markdown | Round-trip spike (P0.8), source mode, round-trip tests in CI |
| Library licensing (tldraw needs a licence key in production; FullCalendar's timeline views are paid) | Build canvas and timeline on permissively licensed building blocks (see `docs/ARCHITECTURE.md` §2) |
| Data loss from a buggy migration | Automatic backup before migrating, migration tests on fixture databases, v1 data left untouched |

## 12. Not in v2.0

- Real-time collaboration and sharing
- Accounts, cloud storage or any server
- AI features (summaries, chat). Possible later: opt-in and on-device first.
- A full Gantt chart (dependencies, critical path)
- A browser extension or web clipper, email integration, contacts/address book

## 13. What happens to the current code

The current app (~4,200 lines) is a reasonable v1, but the new brief breaks its foundations:

- **Data model:** a note is a single markdown string with one `goalDate` and one project. There's no room for ink, stickies, boards, date ranges, times or multi-board placement.
- **Data safety:** if IndexedDB fails once, every later read and write silently switches to an in-memory copy (`src/db/index.ts`). The warning event it fires has no listener, so the user loses everything written after that point on reload without being told.
- **Reactivity:** pages load data once on mount, so changes made in one view don't show in another until reload.
- **Editor:** a raw textarea beside a preview. Fine for markdown users, unfriendly for everyone else, and it can't host sketches or date chips.
- **Timeline:** 7 fixed week buckets showing only notes with a goal date. There's no zoom, no ranges and no side-by-side comparison.
- **Notifications:** `new Notification()` isn't allowed on Android Chrome (it needs the service-worker API), and checks only run every 15 minutes while the app is open.

| Keep | Port as reference (with their tests) | Replace | Retire |
|---|---|---|---|
| Repo, GitHub Pages deploy workflow (bump Node to an LTS), Vite + React + TypeScript + Tailwind + PWA + Vitest + oxlint, IBM Plex fonts, core colour tokens, TimeDoco link | Backup zip logic, checklist parsing, repeat rules, due-date buckets, search tests, attachment handling | Data layer, page-per-route layout, textarea editor, timeline, project-only grouping, notification code | Close-out PDF report (revisit alongside the TimeDoco bridge) |

Existing user data is migrated automatically and non-destructively in P1.10.

## 14. Definition of done (every task)

- Works on a phone (from 360 px wide), a tablet (touch and pen) and a desktop (mouse and keyboard).
- Keyboard-operable, labelled for screen readers, contrast-checked in light and dark, respects reduced motion.
- Works offline and makes no network calls.
- Unit tests for logic; a component or end-to-end test for the user flow; performance budgets still met.
- Reversible actions have undo. Empty, loading and error states are designed, not left blank.
- Schema changes include a migration and a migration test.
- User-facing docs (feature list, shortcuts) are updated.

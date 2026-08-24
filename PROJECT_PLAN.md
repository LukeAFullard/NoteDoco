# NoteDoco — Project Plan

**The second app in the Doco suite.** A privacy-first, 100% client-side notetaking, checklist, and project organisation app — the calmer sibling to TimeDoco (timedoco.com, https://github.com/InYourOwnBrowser/TimeDoco), sharing its visual language, its zero-server ethos, and (eventually) its data.

---

## 1. Vision

> Notes, checklists, and project timelines that live entirely on your device — beautiful, uncluttered, and quietly connected to how you actually spend your time.

**Primary audience:** the same freelancers/contractors/privacy-conscious users TimeDoco already serves — people juggling several client projects who want structure without SaaS bloat or a monthly subscription for their own notes.

**Design mandate:** simple by default, powerful when you dig. Every feature below is judged against one question: *does this clutter the default view?* If yes, it goes behind a view switch, a command palette, or a settings toggle — never onto the main screen by default.

---

## 2. Design & Style Guide

NoteDoco should be visually unmistakable as TimeDoco's sibling — same materials, calmer palette weighting since notes are read/scanned more than timesheets are audited.

### 2.1 Brand relationship

- Same typographic voice, same "analog ledger" materiality (paper, ink, restrained accent colour) rather than generic SaaS-blue gradients.
- Reuse the shared UI primitives (`Panel`, `Button`, `Modal`, `Input`) with identical styling rules — ideally as a shared component package/config down the line, so the two apps never visually drift.
- **Default to dark mode** (a deliberate departure from TimeDoco, which defaults light) — `graphite` becomes the primary surface, `stone` the primary text/paper accent. Light mode remains available via the same toggle pattern TimeDoco uses.

### 2.2 Colour tokens (inherited from TimeDoco's Tailwind config)

| Token | Hex | Role in NoteDoco |
|---|---|---|
| `ink` | `#10161C` | Darkest surface / dark-mode base |
| `stone` | `#EEF0EC` | Paper / light-mode base, dark-mode text |
| `graphite` | `#26313A` | Dark-mode panel surface, light-mode text |
| `signal` (amber) `#D9A54A` / dim `#8A6A2F` | | Upcoming/due-soon, focus & highlight states |
| `verdigris` (teal) `#3E7368` / dim `#295148` | | Completed items, active Bridge sync, success |
| `rust` | `#B85C3E` | Overdue items, destructive actions |

No new colours. If a state needs a colour, it maps to one of the five above — this is a deliberate constraint to keep things calm.

### 2.3 Typography

- **IBM Plex Sans** — UI, note body text.
- **IBM Plex Mono** — dates, timestamps, metadata, goal-date countdowns (`tabular-nums`), matching TimeDoco's numeric styling.

### 2.4 Layout & components

- `Panel`: white/`graphite` background, `rounded-panel` (8px), 20%-opacity border, subtle shadow — reused as-is.
- `Button` variants (`primary` / `secondary` / `danger` / `ghost`) reused as-is; `danger` (rust) reserved for delete/discard actions only.
- Generous whitespace over dense grids — checklists and notes should breathe more than a timesheet matrix does.
- Motion: reuse the existing `breathe` keyframe convention (e.g. for "syncing with TimeDoco" or "recording focus session" states), respecting `prefers-reduced-motion`.

---

## 3. Core Feature Set (baseline)

Table stakes — needed, but not where the differentiation lives:

- **Notes** — lightweight markdown editor (see §5.4), not a heavyweight block editor.
- **Checklists** — nested, reorderable, with optional goal dates per item.
- **Projects / Groups** — nested grouping, modelled on TimeDoco's `GroupingManagement`, so a "project" can mean the same thing in both apps.
- **Up Next dashboard** (home screen) — aggregates overdue / due-today / due-this-week items across all projects, so you never have to dig through folders to see what needs you. The notes equivalent of TimeDoco's persistent active-timer bar.
- **Lightweight timeline/roadmap view** — swimlanes per project, goal dates shown as simple markers/bars. Deliberately *not* a full Gantt chart (no dependency graphs, no critical path) — that complexity works against "beautiful and uncluttered." Full Gantt is a possible v2+ stretch goal, not a v1 commitment.
- Local IndexedDB storage, JSON backup/restore, offline PWA, installable — same non-negotiables as TimeDoco.

---

## 4. Signature Features (what makes NoteDoco worth building)

### 4.1 Doco Suite Bridge
Link a checklist item to a TimeDoco timer in one tap. Completed items show actual time spent (and, using shared rate/currency settings, a $-cost). Paired with goal dates, this enables **predictive deadline warnings** — "at your current tracked pace, this won't land by Friday" — something no standalone note app or time tracker can offer alone.

*Technical note:* since IndexedDB is origin-scoped, the two apps can't silently share storage unless they're served from the same origin (e.g. same domain, different subpaths). Until/unless that's the hosting model, the Bridge will need an explicit hand-off mechanism (import TimeDoco's JSON export, or a lightweight local link via the File System Access API where supported). Worth deciding early — see Open Questions.

### 4.2 Time-Travel History
Because local storage is free of cloud-storage cost pressure, every note/checklist keeps a full, scrubbable edit history — a slider to "rewind to last Tuesday" instead of the usual capped or paywalled version history.

### 4.3 Project Close-Out Report
When a project group is archived, generate one branded PDF combining the completed checklist *and* the time/cost pulled via the Bridge — a client-ready wrap-up report, reusing TimeDoco's proven `jspdf` export muscle. This is the feature only the *pair* of apps can produce.

### 4.4 Plain-Markdown Storage
Notes are authored and stored as plain markdown text (not a proprietary block schema), so every note is portable, human-readable, and trivially exportable — reinforcing the same no-lock-in ethos as TimeDoco's CSV/JSON exports.

### 4.5 Focus Mode
One note, fullscreen, all chrome hidden. Cheap to build, disproportionately makes the app feel calm — and a natural companion to starting a Bridge timer.

---

## 5. Technical Requirements

- **Stack:** React 19, TypeScript, Vite, Tailwind CSS — matching TimeDoco exactly, to maximise shared code/components.
- **Storage:** IndexedDB via `idb`, note content stored as markdown strings.
- **Cross-device / PWA compatibility (explicit requirement):**
  - Fully responsive across phone / tablet / desktop breakpoints — checklist and timeline views need distinct mobile layouts (swimlanes don't work under ~600px; fall back to a stacked list).
  - Touch-friendly targets throughout (checkbox hit areas, drag handles for reordering).
  - Installable manifest + service worker, full offline function, matching TimeDoco's PWA setup.
  - No reliance on filesystem APIs with poor cross-browser support (e.g. File System Access API) for anything core — only as an optional enhancement for the Bridge.
- **Testing:** Vitest + Testing Library + Oxlint, matching TimeDoco's existing quality bar.

---

## 6. Non-Goals (v1)

- Full Gantt chart with dependencies/critical path — parked as a stretch goal.
- Real-time multi-user collaboration.
- Cloud accounts or hosted sync of any kind.
- Peer-to-peer device sync — a strong future idea (solves the classic local-first sync problem without a server), but out of scope until the core product and the Bridge are solid.

---

## 7. Phased Roadmap

- [ ] **Phase 0 — Foundation:** repo scaffold, shared design tokens/components, IndexedDB schema, PWA shell.
- [ ] **Phase 1 — MVP:** notes (markdown), checklists, nested projects/groups, Up Next dashboard.
- [ ] **Phase 2 — Calm & focus:** Focus Mode, Time-Travel History.
- [ ] **Phase 3 — Doco Suite Bridge:** timer linking, time/cost display, predictive deadline warnings.
- [ ] **Phase 4 — Client-facing:** Project Close-Out Report (PDF), lightweight timeline/roadmap view.
- [ ] **Phase 5 — Stretch:** full Gantt option, peer-to-peer sync, shared-origin storage between the two apps.

---

## 8. Open Questions

1. **Bridge mechanism:** same-origin hosting (subpaths) vs. explicit import/export hand-off vs. File System Access API — this decision affects hosting architecture and should be made before Phase 3.
2. **Goal-date granularity:** per-checklist-item, per-note, or both?
3. **Grouping shape:** flat list of projects, or arbitrarily nested folders like TimeDoco's grouping tool?
4. **Markdown flavour:** plain CommonMark, or a light extension (e.g. task-list syntax `- [ ]`) to keep checklists as portable text too?

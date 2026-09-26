# NoteDoco v2 — Research notes

> Gathered September 2026 to inform [`PROJECT_PLAN.md`](../PROJECT_PLAN.md) and [`ARCHITECTURE.md`](ARCHITECTURE.md). Sources are listed at the end. Feature IDs (e.g. INK-11) refer to the plan's feature catalogue.

## 1. What the best apps do, and what we borrow

### 1.1 Handwriting and stylus apps

| App | Notable features | What we take |
|---|---|---|
| **Goodnotes 6** | Circle-to-lasso selection. A lasso "edit handwriting" mode that reflows writing, edits single words and straightens lines. Hand-drawn shapes are cleaned up, can be filled, and lines snap together. Strong handwriting recognition (print, cursive, maths). | Lasso-first editing (INK-6), shape snapping (INK-11); later, recognition and reflow (INK-18, INK-24) |
| **Notability** | Time-synced audio: tap a handwritten word to jump to that moment in the recording, and playback animates the notes as they were written. A "tape" tool hides answers for active recall. | Later: audio sync (INK-22), replay (INK-20), tape tool (INK-21) |
| **OneNote** | Ink to Shape, Ink to Text (including maths), ruler, lasso select, ink replay. | Ruler (INK-15), replay |
| **Microsoft Journal** | Pen-first, "modeless" editing: scratch out to erase and circle to select without switching tools. Scratch-out is its most-used gesture. Pen, highlighter and pencil with pressure. | Scratch-out and circle-to-select gestures (INK-12, INK-13) |
| **Samsung Notes** | PDF import and annotation, voice recording with transcription, handwriting to text, clean-up/straighten. The June 2026 update added grouping notes by date. | PDF annotation (INK-19). Grouping notes by date supports our timeline-first idea. |
| **Apple Notes (iPadOS 18+)** | Smart Script smooths and straightens handwriting, lets you scratch out words and paste typed text in your own handwriting; Math Notes solves written maths. | Inspiration for tidy handwriting (INK-24). Out of reach on the web for now. |

### 1.2 Sticky-note apps

| App | Notable features | What we take |
|---|---|---|
| **Microsoft Sticky Notes (new, 2024+)** | Screenshot capture that links back to its source; copy a whole note; syncs through OneNote. | Capture with a source link (via share-in, CAP-6) |
| **Google Keep** | Colours, labels, pins, checklists, drawings (pen, marker, highlighter), time and location reminders; every note type in one stream. | Fast capture, colour and labels, checklist stickies (STK-1, STK-3) |
| **3M Post-it app** | Photograph up to 200 physical Post-its at once; each becomes a movable digital note on a board; export to PDF, Excel, PowerPoint. | Later spike: photograph a real sticky wall (CAP-10) |

### 1.3 Boards and canvases

| App | Notable features | What we take |
|---|---|---|
| **Milanote** | Boards mixing notes, to-dos, images and links, with kanban-style columns. | Frames and columns on boards (BRD-6) |
| **Heptabase** | Cards on whiteboards, with the same card on several whiteboards (edit once, updates everywhere); daily journal; PDF annotation; tags. | Same item on many boards (BRD-3) |
| **AFFiNE** | Every doc switches between a page mode and an "edgeless" whiteboard mode over the same blocks. Local-first. | Confirms that docs and canvases belong together. We use live note cards on boards rather than a mode switch. |
| **Obsidian Canvas / JSON Canvas** | Text, file, link and group nodes; labelled edges with arrow direction. Stored in the open JSON Canvas format (MIT, spec 1.0). | JSON Canvas import/export (BRD-11) |
| **Apple Freeform** | Scenes (saved viewpoints you can present), snap to grid, connectors that re-route when shapes move. | Scenes and present mode (BRD-10), self-routing arrows (BRD-5) |

### 1.4 Time and planning

| App | Notable features | What we take |
|---|---|---|
| **Notion timeline** | Date ranges as bars; drag edges to change dates; zoom from hours to years; group by a property to make swimlanes; optional table alongside; dependencies. | Lane model, zoom range, range editing (TIME-3, 5, 6) |
| **TickTick** | List, kanban and timeline views; timeline grouped by list or tag; drag to change duration. | Lanes by group or tag (TIME-3) |
| **Aeon Timeline** | Split views, each filtered differently, to compare timelines side by side (e.g. two people or two projects); zoom slider plus Ctrl/⌘-scroll zoom around the cursor. | "Groups side by side" as lanes, columns and split panes (TIME-3, TIME-4, WS-1); zoom interaction |
| **Day One** | Chronological timeline, calendar with entry dots, "On This Day", map view. | Journal-style phone feed (TIME-10), On this day (TIME-16), dots on the mini-calendar |
| **Structured** | A visual day timeline, plus an Inbox for undated to-dos to sort later. | Today agenda (TIME-2) and Inbox (CAP-3) |
| **Hyperlinked digital planners** (for Goodnotes and others) | Year/month/week/day pages joined by tabs and links; hugely popular with stylus users. | Later: auto-generated planner notebooks (TIME-18) |

### 1.5 The gap NoteDoco fills

No mainstream app combines typed, handwritten and sticky items, spatial boards, and a timeline that shows groups side by side, while being local-first and running in the browser.

- **OneNote:** strong mixed ink and typing, but no timeline or boards, and tied to the cloud.
- **AFFiNE:** docs plus whiteboards, but team-oriented and not pen-first.
- **Heptabase:** cards and boards, but no stylus focus, and cloud-based.
- **Goodnotes:** superb ink, but no organiser views.

## 2. The web platform: what the browser can and can't do (September 2026)

| Capability | Status | What it means for us |
|---|---|---|
| Pointer Events: `pressure`, tilt, `pointerType` | All modern browsers, including Apple Pencil pressure in Safari | Pressure-sensitive ink everywhere |
| `getCoalescedEvents()` / `getPredictedEvents()` | Chromium and Firefox; Safari since 18.2 (December 2024) | Full-rate Pencil samples (without them, curves come out as straight segments) and predicted points to lower perceived latency |
| Ink API (delegated ink trail), `desynchronized` canvas | Chromium only | Optional low-latency extras, never required |
| Palm flag | Not on the web | Build heuristics: pen wins, large contacts ignored, a short trailing window after pen-up |
| Pen buttons | Barrel and eraser exposed through the `buttons` bitmask (2 and 32) where the hardware reports them. Apple Pencil double-tap and squeeze are not exposed. | Support pen buttons; keep an on-screen pen/eraser toggle for iPad |
| Pen hover | Reported on supporting hardware and browsers | Hover preview is a nice-to-have (INK-16) |
| Handwriting Recognition API | Chromium only, available in practice on ChromeOS; no Safari or Firefox signal | Recognition must be optional; research on-device alternatives (INK-18) |
| iPad Scribble | Works in Safari text fields | Free handwriting-to-text in typed notes and sticky text on iPad |
| Document Picture-in-Picture | Chromium desktop browsers; Firefox desktop since 151 (May 2026); not Safari, not mobile | Floating stickies on desktop only (STK-8) |
| Storage | IndexedDB everywhere; the Storage API (including `persist()`) fully supported since Safari 17. Safari deletes script-written data after 7 days of browser use without interaction with the site; Home Screen web apps are exempt. Persistent origins are skipped when Safari evicts data under storage pressure; whether persistence also lifts the 7-day rule isn't clearly documented. | Ask for persistence, guide iOS users to install (the documented exemption), keep backup reminders (SAFE-2, SAFE-3) |
| OPFS | Available in all modern browsers; Safari's write support has been limited (synchronous handles in workers) | Not needed for v2.0; consider for large media later |
| Scheduled local notifications | Notification Triggers never shipped (origin trial only); Periodic Background Sync is Chromium-only and imprecise; iOS web push only for Home Screen apps (16.4+) and it needs a server | Reminders while open, catch-up on open, .ics export (TIME-13, TIME-14) |
| Share target, file handlers, app shortcuts | Chromium (Android and desktop); not iOS | Nice-to-haves only (CAP-5, CAP-6) |

## 3. Libraries evaluated

| Need | Candidate | Licence | Verdict |
|---|---|---|---|
| Stroke rendering | `perfect-freehand` | MIT | **Use.** Pressure thinning, smoothing, streamlining and tapering; simulates pressure for mice. |
| Whiteboard SDK | tldraw | tldraw licence: production needs a licence key; hobby licence (non-commercial) keeps a "made with tldraw" watermark; commercial is paid | **Not chosen.** Excellent technology, but licensing and the need for handwriting-grade control push us to our own canvas core. |
| Whiteboard | Excalidraw | MIT | **Not chosen.** Hand-drawn look, whiteboard-first, not built for handwriting. |
| Rich text | TipTap 3 + `@tiptap/markdown` (since 3.7) | MIT (core and markdown extension) | **Use (spike P0.8).** Official two-way Markdown built on MarkedJS. |
| Markdown WYSIWYG | Milkdown | MIT | **Fallback** if TipTap's round-trip isn't good enough; markdown-first (remark). |
| IndexedDB | Dexie 4 | Apache-2.0 | **Use.** `liveQuery` / `useLiveQuery`, versioned schemas. |
| Search | MiniSearch | MIT | **Use.** About 6 KB gzipped. FlexSearch if we ever pass ~100k items. |
| CRDTs (future sync) | Yjs / Automerge 3 | MIT | **Later.** Yjs has the biggest editor ecosystem (TipTap collaboration, `y-indexeddb`). Automerge 3 (2025) cut memory use about 10×. |
| Canvas interchange | JSON Canvas 1.0 | MIT | **Use** for board import/export. |
| Calendar | FullCalendar | MIT core; timeline/resource views are paid Premium | **Not for the timeline.** Build our own. |
| Natural-language dates | `chrono-node` | MIT | **Use.** |
| Accessible components | React Aria Components | Apache-2.0 | **Use.** Date pickers and calendars included. |
| PDF | `pdf.js` / `pdf-lib` | Apache-2.0 / MIT | **Use** (import / vector export). |
| OCR | Tesseract.js | Apache-2.0 | **Later**, in a worker. |
| Spatial index | `rbush` | MIT | **Use.** |
| Ordering | `fractional-indexing` | CC0 | **Use.** |

## 4. Principles adopted

**Local-first software** (Ink & Switch, 2019) sets seven ideals: fast, multi-device, offline, collaboration, longevity, privacy and user control. Its authors now describe them as a gradient rather than a checklist.

- **v2.0 targets:** fast, offline, longevity (open formats), privacy and user control.
- **Later:** multi-device, which is decision D1 in the plan.
- **Not a goal:** collaboration.

## Sources

**Handwriting apps**
- [Goodnotes 6 vs Notability 2026 (AFFiNE)](https://affine.pro/blog/goodnotes-vs-notability-tips) · [GoodNotes vs Notability (AFFiNE)](https://affine.pro/vs/goodnotes-vs-notability)
- [Goodnotes: Lasso tool](https://support.goodnotes.com/hc/en-us/articles/7353695644175-Select-Move-and-Edit-Content-With-the-Lasso-Tool) · [Goodnotes: Edit and reflow handwriting](https://support.goodnotes.com/hc/en-us/articles/10779441732111-Edit-and-reflow-handwriting-with-the-Lasso-tool)
- [OneNote: Replay ink strokes](https://support.microsoft.com/en-us/office/replay-ink-strokes-in-onenote-for-windows-10-cbc9188a-75a3-4f06-9a9e-6410b658b4e3) · [OneNote: New Draw tab and ink tools](https://techcommunity.microsoft.com/blog/microsoft365insiderblog/new-draw-tab-and-ink-tools-in-onenote-on-windows/4215558)
- [PCWorld: Microsoft Journal](https://www.pcworld.com/article/394107/meet-microsofts-new-ink-first-app-journal.html) · [Windows Central: Journal adds pen pressure](https://www.windowscentral.com/microsofts-ink-friendly-journal-app-now-supports-pen-pressure-and-custom-colors)
- [Samsung: Notes features](https://www.samsung.com/us/support/answer/ANS10001384/) · [SammyFans: Samsung Notes June 2026 update](https://www.sammyfans.com/2026/06/04/samsung-notes-adds-three-useful-features-this-june/)
- [Apple: iPadOS 18 Smart Script and Math Notes](https://www.apple.com/newsroom/2024/06/ipados-18-introduces-powerful-intelligence-features-and-apps-for-apple-pencil/)

**Sticky-note apps**
- [Microsoft: The new Sticky Notes app](https://techcommunity.microsoft.com/blog/microsoft365insiderblog/introducing-the-new-sticky-notes-app-on-windows/4223819)
- [Cloudwards: Google Keep review 2026](https://www.cloudwards.net/google-keep-review/)
- [3M: Post-it App FAQ](https://www.post-it.com/3M/en_US/post-it/ideas/app/mobile-faq-v4/)

**Boards and canvases**
- [Milanote](https://milanote.com/) · [MakerStack: Heptabase review 2026](https://makerstack.co/reviews/heptabase-review/) · [AFFiNE whiteboard (edgeless mode)](https://affine.pro/whiteboard)
- [Obsidian Canvas help](https://obsidian.md/help/plugins/canvas) · [JSON Canvas](https://jsoncanvas.org/) · [Obsidian: Announcing JSON Canvas](https://obsidian.md/blog/json-canvas/)
- [Apple Freeform: scenes and snap to grid](https://blog.workapes.com/apple-freeform-app-scenes-scene-navigator-and-snap-to-grid-in-2025/)

**Time and planning**
- [Notion: Timeline view](https://www.notion.com/help/timelines) · [TickTick: Timeline view](https://help.ticktick.com/articles/7055782331050622976)
- [Aeon Timeline: Viewing your data](https://help.timeline.app/article/153-viewing-your-data) · [Aeon Timeline: Navigating your timeline](https://help.aeontimeline.com/article/42-navigating-your-timeline)
- [Day One: On This Day](https://dayoneapp.com/guides/tips-and-tutorials/on-this-day-view/) · [Day One: Features](https://dayoneapp.com/features/) · [Structured](https://structured.app/)
- [Planify: Digital planners with hyperlinks](https://blog.planifypro.com/digital-planner-with-hyperlinks/)

**Web platform**
- [WebKit: Safari 18.2 features](https://webkit.org/blog/16301/webkit-features-in-safari-18-2/) · [W3C Pointer Events](https://w3c.github.io/pointerevents/) · [Apple forums: Pencil Pro pointer events](https://developer.apple.com/forums/thread/776468)
- [WICG: Ink enhancement](https://github.com/WICG/ink-enhancement) · [Chrome: Handwriting recognition](https://developer.chrome.com/docs/web-platform/handwriting-recognition)
- [Chrome: Document Picture-in-Picture](https://developer.chrome.com/docs/web-platform/document-picture-in-picture) · [Firefox 151 release notes](https://www.firefox.com/en-US/firefox/151.0/releasenotes/)
- [WebKit: Updates to storage policy](https://webkit.org/blog/14403/updates-to-storage-policy/) · [MDN: Storage quotas and eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) · [WebKit: OPFS](https://webkit.org/blog/12257/the-file-system-access-api-with-origin-private-file-system/)
- [Chrome: Notification Triggers](https://developer.chrome.com/docs/web-platform/notification-triggers) · [web.dev: PWA OS integration](https://web.dev/learn/pwa/os-integration/) · [MagicBell: PWA iOS limitations 2026](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide)
- [Apple: Scribble on iPad](https://support.apple.com/guide/ipad/enter-text-with-scribble-ipad355ab2a7/ipados)
- Palm rejection and wet-ink approaches in other web ink projects: [sanenotes #819](https://github.com/swiftsaneai/sanenotes/issues/819) · [sanenotes #818](https://github.com/swiftsaneai/sanenotes/issues/818) · [Excalidraw pen mode #4202](https://github.com/excalidraw/excalidraw/issues/4202)

**Libraries**
- [perfect-freehand](https://github.com/steveruizok/perfect-freehand) · [tldraw: Licence key](https://tldraw.dev/sdk-features/license-key) · [tldraw: Licence](https://tldraw.dev/community/license)
- [TipTap: Markdown](https://tiptap.dev/docs/editor/markdown) · [TipTap: Two-way Markdown release](https://tiptap.dev/blog/release-notes/introducing-bidirectional-markdown-support-in-tiptap) · [Liveblocks: Choosing a rich-text editor](https://liveblocks.io/blog/which-rich-text-editor-framework-should-you-choose-in-2025)
- [Dexie: liveQuery](https://dexie.org/docs/liveQuery()) · [PkgPulse: Fuse vs FlexSearch vs Orama 2026](https://www.pkgpulse.com/blog/fusejs-vs-flexsearch-vs-orama-client-side-search-2026) · [npm-compare: search libraries](https://npm-compare.com/elasticlunr,flexsearch,fuse.js,minisearch)
- [PkgPulse: Yjs vs Automerge vs Loro 2026](https://www.pkgpulse.com/guides/yjs-vs-automerge-vs-loro-crdt-libraries-2026)
- [Ink & Switch: Local-first software](https://www.inkandswitch.com/essay/local-first/)

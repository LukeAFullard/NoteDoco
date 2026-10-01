# NoteDoco

A notebook, a corkboard and a planner in one private, offline web app. Type notes, write in Markdown, handwrite with a stylus, or stick up sticky notes. Organise them in groups and boards, and see them on a timeline with groups side by side.

Everything stays on your device: there's no account and no server.

- **The app:** https://lukeafullard.github.io/NoteDoco/ (install it from the browser menu to use it like any other app; the **Ink lab** pen prototype is in the sidebar)

Coming from the previous version? Your notes are brought over automatically the first time you open the new one on the same device, and the originals are left untouched.

## Status
NoteDoco 2 is built from the plan in [`PROJECT_PLAN.md`](PROJECT_PLAN.md). It replaced the first version at the main address on 27 September 2026 (milestone M1, [decision 0007](docs/decisions/0007-m1-v2-replaces-v1.md)).

- **Phase 0 (foundation) is in place:** design system, data layer, app shell, installable PWA, the ink lab, and the editor spike.
- **Phase 1 (notes, stickies and groups) is built:** the formatted note editor, sticky wall, groups with drag and drop, tags, search, history, trash, backup/restore, Markdown import/export, and automatic import of v1 notes.
- **Phase 2 (time and side by side) is built:** dates, due dates, repeats and reminders on any item; Today, Tasks, the timeline (lanes by group, tag, kind or colour, from hours to years), the calendar, add-to-calendar (.ics), split view and groups side by side.
- **Phase 3 (ink) is built, apart from tuning on real pen devices:** handwritten ink notes with pages, paper templates, pressure-sensitive pens, highlighter, erasers, lasso, shape snapping, text boxes and images, sketches inside typed notes, and PDF/SVG/PNG export and printing. Palm rejection and pen latency get their final tuning from the iPad ink-lab results.
- **Next:** the iPad tests, then Phase 4: boards.

## Documents
- [`PROJECT_PLAN.md`](PROJECT_PLAN.md): features, screens and roadmap
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): how it's built
- [`docs/RESEARCH.md`](docs/RESEARCH.md): what other apps and browsers taught us
- [`docs/decisions/`](docs/decisions/): decision records
- [`docs/spikes/`](docs/spikes/): experiment write-ups
- [`AGENTS.md`](AGENTS.md): conventions for contributors and AI agents

## Development
```sh
npm install
npm run dev        # http://localhost:5173
npm run test       # unit and component tests
npm run e2e        # end-to-end tests (Playwright)
```
Before a pull request, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build && npm run size` and `npm run e2e` must all pass (see [`AGENTS.md`](AGENTS.md)).

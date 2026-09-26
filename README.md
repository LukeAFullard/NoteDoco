# NoteDoco

A notebook, a corkboard and a planner in one private, offline web app. Type notes, write in Markdown, handwrite with a stylus, or stick up sticky notes. Organise them in groups and boards, and see them on a timeline with groups side by side.

Everything stays on your device: there's no account and no server.

- **Live app (v1):** https://lukeafullard.github.io/NoteDoco/
- **v2 preview (in development):** https://lukeafullard.github.io/NoteDoco/next/ (includes the **Ink lab** pen prototype)

## Status
v2 is being rebuilt from the plan in [`PROJECT_PLAN.md`](PROJECT_PLAN.md).

- **Phase 0 (foundation) is in place:** design system, data layer, app shell, installable PWA, the ink lab, and the editor spike.
- **Phase 1 (notes, stickies and groups) is built:** the formatted note editor, sticky wall, groups with drag and drop, tags, search, history, trash, backup/restore, Markdown import/export, and automatic import of v1 notes.
- **Next:** switch the live site to v2 (milestone M1), then Phase 2: Today, the timeline with groups side by side, and the calendar.

## Documents
- [`PROJECT_PLAN.md`](PROJECT_PLAN.md): features, screens and roadmap
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): how it's built
- [`docs/RESEARCH.md`](docs/RESEARCH.md): what other apps and browsers taught us
- [`docs/decisions/`](docs/decisions/): decision records
- [`docs/spikes/`](docs/spikes/): experiment write-ups
- [`AGENTS.md`](AGENTS.md): conventions for contributors and AI agents

## Development
```sh
cd app
npm install
npm run dev        # http://localhost:5173
npm run test       # unit and component tests
npm run e2e        # end-to-end tests (Playwright)
```
The v1 app lives at the repository root (`npm install && npm run dev` there).

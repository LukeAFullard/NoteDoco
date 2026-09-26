# Working on NoteDoco

Guidance for anyone (people or AI coding agents) changing this repository. Read this first, then the relevant parts of the plan.

## What's where
- **`PROJECT_PLAN.md`**: the product plan. Features have IDs (e.g. `INK-6`), roadmap tasks have IDs (e.g. `P1.3`). Reference both in PR titles and descriptions.
- **`docs/ARCHITECTURE.md`**: how v2 is built. **`docs/decisions/`**: why (read before changing anything they cover). **`docs/spikes/`**: experiment write-ups.
- **`app/`**: **v2**, the app being built. All new work goes here.
- Repository root (`src/`, `package.json`): **v1**, the current live app. Only fix critical bugs there; it's retired at milestone M1 (decision 0002).

## Commands (run from `app/`)
| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run lint` · `npm run typecheck` · `npm run test` | Must all pass before a PR |
| `npm run build && npm run size` | Production build and the startup-JavaScript budget (200 KB gzipped) |
| `npm run e2e` | Playwright end-to-end tests (desktop and phone). In the cloud dev container set `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome` |

## Code layout (`app/src/`)
`app/` shell, routing, palette · `design/` tokens and primitives · `data/` database, repositories, undo · `canvas/` shared pen/canvas core · `features/<area>/` screens · `lab/` prototypes · `spikes/` experiment tests · `lib/` helpers. See ARCHITECTURE §3.

## Rules
1. **Data:**
   - Write through the repositories in `data/repos/`; they stamp `updatedAt`, `rev` and `updatedBy` via `freshMeta()`/`touched()`.
   - Delete by setting `deletedAt` (trash), never hard-delete, except when purging the trash.
   - Read in components with live queries (`data/hooks.ts`).
2. **Never add an in-memory fallback for storage.** If storage fails, the user must be told (decision 0003).
3. **Schema changes:** add a new `this.version(n)` in `data/db.ts` with an upgrade function and a migration test. Never edit an existing version (a snapshot test guards version 1).
4. **Reversible actions get an Undo toast, not a confirmation dialog.** Use `recordUndo` (or an action in `data/actions.ts`) and `toastWithUndo`.
5. **Colours come from tokens only**, as Tailwind classes like `bg-surface text-muted` or `var(--sticky-lemon)`; no raw hex in components. New colours need contrast tests (`lib/palette.test.ts`).
6. **Accessibility:** use the primitives in `design/` (React Aria underneath). Icon-only buttons need `label`. Everything must work by keyboard. Colour is never the only signal.
7. **Every screen works at 360 px, tablet and desktop.** Views render inside `<Pane>`.
8. **Keep startup small:** lazy-load new screens and heavy libraries (editor, ink, PDF, calendar) with `lazy()`. `npm run size` fails the build otherwise.
9. **Preferences** in `localStorage` go through `lib/localPref.ts` (keys are prefixed; the origin is shared with other GitHub Pages sites).
10. **Words:** UI copy is plain, friendly British English ("colour", "organise"). Identifiers use `colour` too, for consistency.
11. Register new screens and actions in the command palette (`app/CommandPalette.tsx`).

## Definition of done
See `PROJECT_PLAN.md` §14. In short: phone/tablet/desktop checked, keyboard and screen-reader friendly, offline, tested (unit + a component or e2e test for the flow), budgets met, undo for reversible actions, designed empty/loading/error states, docs updated.

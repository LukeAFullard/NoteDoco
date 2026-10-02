# Working on NoteDoco

Guidance for anyone (people or AI coding agents) changing this repository. Read this first, then the relevant parts of the plan.

## What's where
- **`PROJECT_PLAN.md`**: the product plan. Features have IDs (e.g. `INK-6`), roadmap tasks have IDs (e.g. `P1.3`). Reference both in PR titles and descriptions.
- **`docs/ARCHITECTURE.md`**: how v2 is built. **`docs/decisions/`**: why (read before changing anything they cover). **`docs/spikes/`**: experiment write-ups.
- **The app** is the repository itself (`src/`, `e2e/`, `package.json`), deployed at `/NoteDoco/`. It replaced v1 at milestone M1 (decision 0007); v1 lives on only in git history, and its notes are imported automatically (`src/migration/v1.ts`).
- **`public/next/`** only redirects the old v2 preview address. Leave it alone unless you're removing it.

## Commands
| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run lint` · `npm run typecheck` · `npm run test` | Must all pass before a PR |
| `npm run build && npm run size` | Production build and the startup-JavaScript budget (200 KB gzipped) |
| `npm run e2e` | Playwright end-to-end tests (desktop and phone), including axe accessibility scans and a phone-overflow check. In the cloud dev container set `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome` |

## Code layout (`src/`)
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
11. Register new screens in `src/app/routes.tsx` (every pane uses that list) and add them and their actions to the command palette (`src/app/CommandPalette.tsx`).
12. **Dates:** all-day dates are `LocalDate` strings ("2026-10-02") and timed ones are UTC instants; use the helpers in `lib/time.ts`. Query dated things through `data/agenda.ts`.

## Gotchas we've hit (don't repeat them)
- **File inputs:** copy `input.files` into an array before resetting the input. The FileList is live and empties.
- **Typed arrays from storage** can come from another realm: check with `Object.prototype.toString.call(x) === '[object Uint8Array]'`, not `instanceof`.
- **No horizontal scrollers on phones:** content wider than the screen makes mobile browsers zoom out the whole page (`e2e/layout.spec.ts` guards this).
- **Transforms create stacking contexts:** a rotated sticky can't lift its children above a sibling overlay link, so sticky cards take clicks themselves.
- **Don't keep callbacks in a subscribed store** if a component re-registers them every render; that loops. Use a module variable.
- **e2e:** wait for the editor or dialog to have focus before typing. Shortcuts are ignored while a dialog is open or closing.
- **A screen can be open in several panes at once** (split view). Document-level listeners (paste, keys, drops) must check `useIsActivePane()` or `useInPane()` from `src/app/paneContext.ts`, or they'll act in every pane.
- **Never `new Date('2026-10-02')`:** that's midnight UTC, which is the previous day west of Greenwich. Use `fromLocalDate()`.
- **e2e and the clock:** tests run at any time of day, so scroll time grids to the hours you need, and dismiss toasts before pointer work near the bottom of the screen.
- **Heavy chunks** (editor ≈200 KB gz, search worker, PDF export ≈180 KB gz) are lazy; the editor is preloaded when idle.
- **The ink engine listens to native pointer events** on its canvas host, and those run before React's handlers. DOM inside it (text boxes, images) must carry `data-ink-element`, or the engine draws under them.
- **Focusing a new input after a tap:** the browser moves focus to the tapped element after `pointerdown`, so focus the new input on the next frame.
- **Ink order is id order.** Stroke ids are UUIDv7, so sorting by id gives the stacking order. Pieces of a split stroke get `<id>~n` ids to keep their place; don't re-id strokes when changing them (move, recolour), or they jump to the top.
- **pdf-lib mis-draws SVG's shorthand `T` curves:** give `drawSvgPath` explicit curves (`strokePath(…, true)`).
- **Saves fail after startup too** (a full device, a closed database). Don't swallow write errors: let them reject (the global handler shows the banner) or call `reportStorageError`.
- **Records without `updatedAt`** (ink pages, strokes, elements) can't be merged record by record: they follow their item (see `mergeInk` in `backup/backup.ts`). New tables like that need the same treatment.
- **Ink e2e:** send pen and touch input through `e2e/support/pen.ts` (DevTools protocol). The canvas has `data-strokes` with the stroke count, and strokes must start on the page (pages are centred, so the canvas edges are often desk).

## Definition of done
See `PROJECT_PLAN.md` §14. In short: phone/tablet/desktop checked, keyboard and screen-reader friendly, offline, tested (unit + a component or e2e test for the flow), budgets met, undo for reversible actions, designed empty/loading/error states, docs updated.

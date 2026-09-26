# 0001 — Stack and core libraries for v2

**Status:** Accepted · 26 Sep 2026

## Context
v2 is a rebuild (see `PROJECT_PLAN.md` §13). It must run fully in the browser, offline, on phones, tablets with pens, and desktops, and it will be built largely by AI coding agents in PR-sized steps, so a mainstream, well-documented stack matters.

## Decision
- **Build/UI:** Vite 8, React 19, TypeScript 7 (strict, `noUncheckedIndexedAccess`), Tailwind CSS 4 with CSS-variable design tokens.
- **Accessible primitives:** React Aria Components. **Command palette:** cmdk. **Icons:** lucide-react.
- **Routing:** React Router 8, hash mode (GitHub Pages has no server rewrites).
- **State:** Dexie live queries for stored data; Zustand for UI state.
- **Tests:** Vitest + Testing Library + fake-indexeddb; Playwright for end-to-end, including pen input via the Chrome DevTools protocol; oxlint.
- Full rationale and alternatives: `docs/ARCHITECTURE.md` §2.

## Consequences
- Heavy modules (editor, ink, PDF, calendar) must be lazy-loaded; CI fails if startup JavaScript exceeds 200 KB gzipped (`app/scripts/check-bundle.mjs`). At the end of Phase 0 it is 187 KB, so every new startup dependency needs a look.
- TypeScript 7 removed `baseUrl`; path aliases use `paths` with `./` prefixes.

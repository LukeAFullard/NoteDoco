# 0002 — Build v2 in `app/`, preview at `/NoteDoco/next/` until M1

**Status:** Superseded by [0007](0007-m1-v2-replaces-v1.md) (v2 moved to the root at M1, 27 Sep 2026) · Accepted 26 Sep 2026 · Replaces the plan's original "build on a long-lived v2 branch" (D9)

## Context
The live site deploys from `main`. v1 must keep working until v2 can replace it (milestone M1), but v2 needs to be deployed early so it can be tried on real devices, especially the ink lab on an iPad. A long-lived branch can't be deployed and drifts from `main`.

## Decision
- v2 lives in `app/` with its own `package.json`, lockfile and tests. v1 stays at the repository root, untouched apart from build plumbing.
- The Pages workflow builds both: v1 at `/NoteDoco/`, v2 at `/NoteDoco/next/`.
- v1's service worker skips navigations under `/NoteDoco/next/` (`navigateFallbackDenylist`), otherwise an installed v1 would answer v2's URLs with v1. v2's service worker is scoped to `/next/`.
- At M1, v2 moves to the root, v1 is deleted, and v2 imports v1 data automatically (P1.10).

## Consequences
- PRs can merge to `main` continuously without breaking v1.
- Someone who has v1 installed and visits `/next/` before their v1 service worker has updated may see v1 once; a reload fixes it.
- Both apps share one origin, so they share IndexedDB (different database names: `note-doco-db` vs `notedoco`) and `localStorage` (v2 prefixes every key with `notedoco:`).

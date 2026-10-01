# 0007 — M1: v2 replaces v1 at the main address

**Status:** Accepted · 27 Sep 2026 · Supersedes 0002

## Context
v2 was built in `app/` and previewed at `/NoteDoco/next/` beside v1 (decision 0002). By the end of Phase 2 it does everything v1 did and more, and it imports v1's notes automatically (P1.10). The owner asked to switch.

## Decision
- v2 moves to the repository root and is deployed at `/NoteDoco/`. v1's code is deleted; it stays in git history (the last commit with v1 at the root is `cb47e7b`).
- **v1 data:** every start, v2 reads v1's database (`note-doco-db`) on the same device and adds anything new. v1's database is never changed or deleted, so nothing can be lost by the switch.
- **Installed v1 apps and open v1 tabs** come over by themselves. The service worker lives at the same address and v2's manifest has the same scope, so a Home Screen or desktop install keeps working and opens v2. v1 has no updater that reloads it, so the first time v2's worker installs where v2 isn't already in charge, it takes over at once and reloads open pages (`public/sw-extras.js`). A marker cache then records that v2 is in charge, so later v2 updates wait and ask before reloading, as before.
- **The old preview address** `/NoteDoco/next/` now only redirects (keeping the `#/…` part of the address). Its service worker (`public/next/sw.js`) replaces the preview's worker, clears the preview's caches, unregisters itself and sends open tabs to the main address. The main service worker neither caches nor answers `/next/`.
- Notes kept in the browser are shared by everything on the site, so preview users find their v2 notes at the main address.

## Consequences
- One app, one `package.json`, one CI job and one deploy.
- **Rehearsed before release** in Chromium against a local copy of the site: an open v1 tab reloaded into v2, an open preview tab was sent to the main address, notes from both appeared in v2, the old `/next/` link redirected, and a later v2 update still waited for the prompt.
- GitHub Pages lets browsers cache pages for up to 10 minutes, so for that long after the switch a browser may still show a cached v1 or preview page once. It sorts itself out on the next visit.
- **iPhone and iPad Home Screen apps keep their own storage**, separate from Safari's. Anyone who used the preview from a Home Screen icon for `/next/` should back up there first (Settings → Backup & import → Back up now), add the main address to the Home Screen, and restore the backup in it.
- `/next/` can be removed once nobody is likely to still have the preview installed.

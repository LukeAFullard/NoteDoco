# 0003 — Local-first storage in IndexedDB via Dexie, with no silent fallback

**Status:** Accepted · 26 Sep 2026

## Context
v1 hand-wrote IndexedDB access with `idb`. When a call failed it switched every later read and write to an in-memory copy and fired an event nobody listened to, so anything written afterwards vanished on reload without warning. Views also loaded data once, so changes didn't show elsewhere until reload.

## Decision
- Dexie 4 over IndexedDB, database `notedoco`, schema in `app/src/data/db.ts`.
- If storage can't open, the app shows a blocking banner (`StorageBanner`) and **never** falls back to memory.
- Views read through live queries (`app/src/data/hooks.ts`), so every view and tab updates when data changes.
- Records are sync-ready: UUIDv7 ids, `updatedAt`/`rev`/`updatedBy` stamped on every write (`touched()`), `deletedAt` tombstones, fractional ordering.
- Trash is soft delete. Trashing a group stamps the group, its sub-groups and their items with one `deletedAt`, so restoring brings back exactly that set.
- Schema version 1 is frozen by a snapshot test; changes need a new version with an upgrade function and a migration test.

## Consequences
- IndexedDB can't index booleans or `null`, so flags like `pinned` are filtered in memory, and `deletedAt: null` records are simply absent from that index.
- Any new write path must go through `freshMeta()` / `touched()`.

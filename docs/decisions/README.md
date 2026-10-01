# Decision records

Short records of decisions that shape the codebase: the context, what we chose, and what follows from it. Add a new numbered file rather than rewriting an old one. If a decision is reversed, mark the old record **Superseded by NNNN**.

| # | Decision | Status |
|---|---|---|
| [0001](0001-stack.md) | Stack and core libraries for v2 | Accepted |
| [0002](0002-v2-alongside-v1.md) | Build v2 in `app/`, preview at `/NoteDoco/next/` until M1 | Superseded by 0007 |
| [0003](0003-local-first-storage.md) | Local-first storage in IndexedDB via Dexie, with no silent fallback | Accepted |
| [0004](0004-custom-ink-engine.md) | Custom ink engine on Pointer Events + perfect-freehand | Proposed: awaiting device results from the ink lab |
| [0005](0005-editor.md) | TipTap 3 with Markdown as the stored format | Accepted |
| [0006](0006-product-defaults.md) | Product defaults assumed from the plan (single device, iPad first, palette) | Accepted, revisit on request |
| [0007](0007-m1-v2-replaces-v1.md) | M1: v2 replaces v1 at the main address; `/next/` redirects | Accepted |

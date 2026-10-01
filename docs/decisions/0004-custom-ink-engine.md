# 0004 — Custom ink engine on Pointer Events + perfect-freehand

**Status:** Proposed · 26 Sep 2026 · Becomes Accepted or Rejected after device testing (see `docs/spikes/P0.7-ink-lab.md`)

## Context
Handwriting is the riskiest feature. The obvious canvas SDK (tldraw) needs a licence key in production and a paid licence for commercial use, and handwriting needs control a whiteboard SDK doesn't give (pages, palm rejection, pen buttons).

## Decision (proposed)
Build our own engine: Pointer Events with full-rate (coalesced) and predicted samples, a heuristic palm-rejection router, `perfect-freehand` outlines, dry and wet canvas layers, `rbush` for hit-testing, and compact varint point storage. The ink lab (`src/lab/ink/`) is the prototype; the reusable parts are already in `src/canvas/`.

## Go/no-go criteria (from real devices)
- **iPad + Apple Pencil (Safari, installed):** pen samples at ≥ 200/s with full-rate samples on; no stray marks from a resting palm over a page of writing; the owner judges the feel "close to a native notes app".
- **Windows or Android pen device:** the same, plus the pen's eraser end or barrel button works.
- Event-to-frame p95 under one frame (≈ 16 ms at 60 Hz, ≈ 8 ms at 120 Hz), with paint cost p95 under 4 ms.

If iPad fails on feel alone, the fallback is a native wrapper (Capacitor) around the same web code, not a different engine.

## Progress (1 Oct 2026)
Everything that doesn't depend on the device results is built on this engine (Phase 3: `src/canvas/`, `src/features/ink/`; see ARCHITECTURE §8.6). If the iPad falls short, the fallback above still applies: it wraps the same web code. The device report decides the default palm-rejection thresholds, whether prediction and the low-latency canvas stay on, and the performance pass. The thresholds are already adjustable in Settings → Pen & ink, so the report's numbers can be tried before they become defaults.

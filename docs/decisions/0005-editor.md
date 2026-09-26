# 0005 — TipTap 3 with Markdown as the stored format

**Status:** Accepted · 26 Sep 2026 · Evidence: `docs/spikes/P0.8-markdown-roundtrip.md`

## Decision
Typed notes use TipTap 3 with the official `@tiptap/markdown` extension. Note bodies are stored as Markdown strings; the editor parses on open and serialises on save. Milkdown stays the fallback but isn't needed.

## Consequences (requirements for Phase 1)
- Load the **Image** extension (without it, images are silently dropped) and a **WikiLink** node (without it, `[[links]]` are stored escaped as `\[\[…\]\]`). A working WikiLink prototype is in `app/src/spikes/wikiLink.ts`.
- Some Markdown is normalised on the first save in the rich editor: `*` bullets become `-`, "underline" headings become `#` headings, and table columns are padded. The content is unchanged; saves are stable afterwards.
- Inline HTML is stripped (its text is kept). Plain-text notes and source mode store text byte-for-byte, so users who need exact Markdown or HTML have a way to keep it.
- Keep the round-trip corpus in CI (`app/src/spikes/markdownRoundTrip.test.ts`) and add a case whenever a new node or mark is introduced.

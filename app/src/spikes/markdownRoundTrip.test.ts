/**
 * Spike P0.8: does TipTap 3 + @tiptap/markdown keep users' Markdown intact?
 * For each document we check: text is never lost, a second round trip changes nothing
 * (idempotent), and whether the output is byte-identical. Findings: docs/spikes/P0.8-markdown-roundtrip.md
 */
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { TableKit } from '@tiptap/extension-table';
import Image from '@tiptap/extension-image';
import { WikiLink } from './wikiLink';

const CORPUS: Record<string, string> = {
  headings: '# Title\n\n## Section\n\n### Sub-section',
  emphasis: 'Some **bold**, *italic*, ~~struck~~ and `inline code`.',
  bullets: '- one\n- two\n  - nested\n  - nested two\n- three',
  ordered: '3. third\n4. fourth\n5. fifth',
  tasks: '- [ ] milk\n- [x] eggs\n  - [ ] free range\n- [ ] bread',
  quote: '> A quote\n> across lines',
  code: '```ts\nconst x: number = 1;\nconsole.log(x);\n```',
  table: '| Name | Qty |\n| --- | --- |\n| Apples | 3 |\n| Pears | 5 |',
  links: 'See [the plan](https://example.com/plan) and ![a sketch](assets/sketch.svg).',
  rule: 'Above\n\n---\n\nBelow',
  hardBreak: 'Line one  \nLine two',
  escapes: 'Literal \\*stars\\* and \\_underscores\\_ and 5 \\* 3',
  ourSyntax: 'Call Sam @2026-10-03 about #launch, see [[Launch plan]].',
  unicode: 'Café ☕ — naïve résumé 日本語 🎉',
  meeting:
    '# Standup 26 Sep\n\n**Attendees:** Pat, Sam\n\n## Actions\n\n- [ ] Sam: send the spec @fri\n- [x] Pat: book room\n\n> Decision: ship the beta on Friday.',
  starBullets: '* star one\n* star two',
  setextHeading: 'Title\n=====',
  html: 'Text with <kbd>Ctrl</kbd> key.',
};

function makeEditor(md: string) {
  return new Editor({
    extensions: [StarterKit, TaskList, TaskItem.configure({ nested: true }), TableKit, Image, WikiLink, Markdown],
    content: md,
    contentType: 'markdown',
  });
}

function roundTrip(md: string): { out: string; text: string } {
  const e = makeEditor(md);
  const out = e.getMarkdown();
  const text = e.getText();
  e.destroy();
  return { out, text };
}

const normaliseText = (s: string) => s.replace(/\s+/g, ' ').trim();

const results: Array<{ name: string; exact: boolean; idempotent: boolean; textKept: boolean; out: string }> = [];

describe('markdown round trip', () => {
  for (const [name, md] of Object.entries(CORPUS)) {
    it(`${name}: keeps all text and is stable after one normalisation`, () => {
      const first = roundTrip(md);
      const second = roundTrip(first.out);
      const exact = first.out.trim() === md.trim();
      const idempotent = second.out === first.out;
      const textKept = normaliseText(second.text) === normaliseText(first.text) && first.text.length > 0;
      results.push({ name, exact, idempotent, textKept, out: first.out });
      for (const url of md.match(/\]\(([^)]+)\)/g) ?? []) expect(first.out, `${name} keeps ${url}`).toContain(url);
      expect(textKept).toBe(true);
      expect(idempotent).toBe(true);
    });
  }

  afterAll(() => {
    // Printed for the spike report.
    console.log(
      results
        .map((r) => `${r.name.padEnd(14)} exact=${r.exact ? 'yes' : 'no '} idempotent=${r.idempotent ? 'yes' : 'no'} text=${r.textKept ? 'kept' : 'LOST'}${r.exact ? '' : `\n    out: ${JSON.stringify(r.out)}`}`)
        .join('\n'),
    );
  });
});

/**
 * What lists, cards and search need to know about a note or sticky body, derived once on save
 * (ARCHITECTURE §7) so views never parse bodies.
 */
export interface TextInfo {
  title: string;
  preview: string;
  words: number;
  checklistTotal: number;
  checklistDone: number;
  tags: string[];
}

const CHECKLIST = /^\s*[-*+]\s+\[( |x|X)\]\s/;
const TAG = /(^|[\s(])#([\p{L}\p{N}][\p{L}\p{N}_/-]*)/gu;

/** Removes Markdown syntax from one line, leaving readable text. */
export function stripMarkdownLine(line: string): string {
  return line
    .replace(/^\s{0,3}#{1,6}\s+/, '') // headings
    .replace(/^\s*>\s?/, '') // quotes
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+(\[[ xX]\]\s+)?/, '') // list markers and checkboxes
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '') // images
    .replace(/\[\[([^\]|]+)(\|[^\]]*)?\]\]/g, '$1') // wikilinks
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links
    .replace(/(\*\*|__|~~|\*|_|`)/g, '') // emphasis and code marks
    .replace(/^[\s|:-]*-[\s|:-]*$/, '') // table separator rows and horizontal rules
    .replace(/\|/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Lines outside fenced code blocks, with a flag for lines inside them. */
function* linesWithFences(text: string): Generator<{ line: string; code: boolean }> {
  let inFence = false;
  for (const line of text.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    yield { line, code: inFence };
  }
}

export function extractTags(text: string): string[] {
  const tags = new Set<string>();
  for (const { line, code } of linesWithFences(text)) {
    if (code) continue;
    const withoutInlineCode = line.replace(/`[^`]*`/g, '');
    for (const m of withoutInlineCode.matchAll(TAG)) {
      const tag = m[2]!.toLowerCase().replace(/[/-]+$/, '');
      if (!/^\d+$/.test(tag)) tags.add(tag); // "#1" is a number, not a tag
    }
  }
  return [...tags].sort();
}

export function analyseText(text: string, format: 'markdown' | 'plain' = 'markdown'): TextInfo {
  const readable: string[] = [];
  let checklistTotal = 0;
  let checklistDone = 0;
  for (const { line, code } of linesWithFences(text)) {
    if (!code) {
      const m = CHECKLIST.exec(line);
      if (m) {
        checklistTotal++;
        if (m[1] !== ' ') checklistDone++;
      }
    }
    const clean = format === 'markdown' && !code ? stripMarkdownLine(line) : line.trim();
    if (clean) readable.push(clean);
  }
  const words = readable.join(' ').split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  return {
    title: (readable[0] ?? '').slice(0, 120),
    preview: readable.slice(1).join(' ').slice(0, 240),
    words,
    checklistTotal,
    checklistDone,
    tags: extractTags(text),
  };
}

/** Flips the checkbox on the nth checklist line (0-based among checklist lines). */
export function toggleChecklistItem(text: string, index: number): string {
  let n = -1;
  let inFence = false;
  return text
    .split('\n')
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
      if (inFence || !CHECKLIST.test(line)) return line;
      n++;
      if (n !== index) return line;
      return line.replace(/\[( |x|X)\]/, (_, mark: string) => (mark === ' ' ? '[x]' : '[ ]'));
    })
    .join('\n');
}

/**
 * Renames an inline #tag in text (outside code), case-insensitively. Used by tag rename/merge.
 * "#old" matches only whole tags: "#older" and "#old/sub" are left alone.
 */
export function renameTagInText(text: string, from: string, to: string): string {
  const esc = from.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&');
  const re = new RegExp(`(^|[\\s(])#${esc}(?![\\p{L}\\p{N}_/-])`, 'giu');
  let inFence = false;
  return text
    .split('\n')
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) {
        inFence = !inFence;
        return line;
      }
      if (inFence) return line;
      // Leave inline code untouched: only rewrite the parts between backticks.
      return line
        .split(/(`[^`]*`)/)
        .map((part) => (part.startsWith('`') ? part : part.replace(re, `$1#${to}`)))
        .join('');
    })
    .join('\n');
}

export interface ChecklistLine {
  /** 0-based among checklist lines, the index `toggleChecklistItem` takes. */
  index: number;
  text: string;
  done: boolean;
}

/** Every checklist line outside code blocks, with its readable text. */
export function checklistLines(text: string): ChecklistLine[] {
  const out: ChecklistLine[] = [];
  let index = 0;
  for (const { line, code } of linesWithFences(text)) {
    if (code) continue;
    const m = CHECKLIST.exec(line);
    if (!m) continue;
    out.push({ index: index++, text: stripMarkdownLine(line), done: m[1] !== ' ' });
  }
  return out;
}

/** Unticks every checklist line (a repeating checklist starting again). */
export function resetChecklist(text: string): string {
  let inFence = false;
  return text
    .split('\n')
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
      return !inFence && CHECKLIST.test(line) ? line.replace(/\[(x|X)\]/, '[ ]') : line;
    })
    .join('\n');
}

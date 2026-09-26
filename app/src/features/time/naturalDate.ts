import * as chrono from 'chrono-node/en';
import type { TimeSpan } from '@/data/types';
import { allDaySpan, timedSpan, toLocalDate } from '@/lib/time';
import { formatRule, type Rule } from '@/lib/recurrence';

/**
 * Natural-language dates (TIME-1, CAP-2): "fri 3pm", "next tue", "5–9 oct", "by 1 oct".
 * Loaded on demand (chrono-node's English parser is ~13 KB gzipped).
 */

/** Day-month order follows the device: 12/10 is 12 October outside the US. */
const parser = () => (/^en-US\b/i.test(globalThis.navigator?.language ?? '') ? chrono.casual : chrono.GB);

export interface NaturalDate {
  span: TimeSpan;
  /** The words that were read as the date, e.g. "on fri at 3pm". */
  matched: string;
  index: number;
}

export function parseNatural(text: string, now = new Date()): NaturalDate | null {
  const r = parser().parse(text, now, { forwardDate: true })[0];
  if (!r) return null;
  const timed = r.start.isCertain('hour');
  const start = r.start.date();
  const end = r.end?.date() ?? null;
  const span = timed ? timedSpan(start, end) : allDaySpan(toLocalDate(start), end ? toLocalDate(end) : null);
  return { span, matched: r.text, index: r.index };
}

const WEEKDAY_CODES: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
const REPEAT = /\b(?:every|each)\s+(day|weekday|week|fortnight|month|year|(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*)\b/i;

/** "every friday", "every day", "each month" → a repeat rule. */
function parseRepeat(text: string): { rule: Rule; matched: string } | null {
  const m = REPEAT.exec(text);
  if (!m) return null;
  const word = m[1]!.toLowerCase();
  const base: Rule = { freq: 'DAILY', interval: 1, byDay: null, until: null, mode: 'move' };
  const rule: Rule =
    word === 'day' ? base
    : word === 'weekday' ? { ...base, freq: 'WEEKLY', byDay: [1, 2, 3, 4, 5] }
    : word === 'week' ? { ...base, freq: 'WEEKLY' }
    : word === 'fortnight' ? { ...base, freq: 'WEEKLY', interval: 2 }
    : word === 'month' ? { ...base, freq: 'MONTHLY' }
    : word === 'year' ? { ...base, freq: 'YEARLY' }
    : { ...base, freq: 'WEEKLY', byDay: [WEEKDAY_CODES[word.slice(0, 3)] ?? 1] };
  return { rule, matched: m[0] };
}

export interface Capture {
  text: string;
  when: TimeSpan | null;
  due: TimeSpan | null;
  recurrence: string | null;
}

/**
 * Reads a one-line capture: "call Sam fri 3pm" → "call Sam", Friday 15:00. "by"/"due" before
 * the date makes it a due date ("pay rent by 1 oct"); "every friday" makes it repeat.
 */
export function parseCapture(input: string, now = new Date()): Capture {
  let text = input.trim();
  const repeat = parseRepeat(text);
  if (repeat) text = text.replace(repeat.matched, ' ');
  const date = parseNatural(text, now);
  let when: TimeSpan | null = null;
  let due: TimeSpan | null = null;
  if (!date && repeat) {
    // "every friday" with no other date starts on the next Friday; "every day" starts today.
    when = parseNatural(repeat.matched.replace(/^(every|each)\s+/i, ''), now)?.span ?? allDaySpan(toLocalDate(now));
  }
  if (date) {
    const before = text.slice(0, date.index);
    const isDue = /\b(by|due|before|deadline)\s*$/i.test(before) || /^(by|due)\b/i.test(date.matched);
    text = (before.replace(/\b(by|due|before|deadline|on|at|from|for)\s*$/i, '') + ' ' + text.slice(date.index + date.matched.length)).trim();
    if (isDue) due = date.span;
    else when = date.span;
  }
  return { text: text.replace(/\s{2,}/g, ' ').trim(), when, due, recurrence: repeat ? formatRule(repeat.rule) : null };
}

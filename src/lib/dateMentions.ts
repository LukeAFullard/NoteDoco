import type { Instant, LocalDate } from '@/data/types';
import { addDays, atTime, todayLocal, weekday } from './time';

/**
 * Date mentions (NOTE-9): `@2026-10-02` (or `@2026-10-02T15:00`) in notes and stickies.
 *
 * People type shorthand like `@fri` or `@tomorrow`; as soon as the word is finished it's
 * rewritten to the ISO date, so the text never drifts ("@fri" would mean a different day next
 * week). The ISO form is readable as plain text, round-trips through Markdown, and is what
 * the Tasks and Today views index.
 */

export const MENTION = /(^|[\s(])@(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?(?![\w-])/g;

const WEEKDAY_WORDS: [RegExp, number][] = [
  [/^sun(day)?$/, 0],
  [/^mon(day)?$/, 1],
  [/^tue(s|sday)?$/, 2],
  [/^wed(nesday)?$/, 3],
  [/^thu(r|rs|rsday)?$/, 4],
  [/^fri(day)?$/, 5],
  [/^sat(urday)?$/, 6],
];

/** A shorthand word (without the @) as a date, or null. Weekdays mean the next one, not today. */
export function shorthandDate(word: string, now = new Date()): LocalDate | null {
  const w = word.toLowerCase();
  const today = todayLocal(now);
  // No "tom" or "tod": they're names (@tom means Tom, not tomorrow).
  if (w === 'today') return today;
  if (w === 'tomorrow' || w === 'tmrw') return addDays(today, 1);
  if (w === 'yesterday') return addDays(today, -1);
  if (w === 'nextweek' || w === 'next-week') return addDays(today, 7 - ((weekday(today) + 6) % 7)); // next Monday
  for (const [re, day] of WEEKDAY_WORDS) {
    if (re.test(w)) return addDays(today, ((day - weekday(today) + 6) % 7) + 1);
  }
  return null;
}

const SHORTHAND = /(^|[\s(])@([A-Za-z][A-Za-z-]*)(?=[\s.,;:!?)])/g;
const SHORTHAND_FINAL = /(^|[\s(])@([A-Za-z][A-Za-z-]*)(?=[\s.,;:!?)]|$)/g;

/**
 * Rewrites finished shorthand mentions to ISO dates. `@sam` is left alone.
 *
 * While typing, only words followed by a space or punctuation are rewritten (someone typing
 * "@fri" may be on the way to "@friday"), so it's safe to run on every keystroke. Pass
 * `final` when the text is complete (saving a capture, closing a sticky).
 */
export function resolveDateMentions(text: string, now = new Date(), { final = false } = {}): string {
  if (!text.includes('@')) return text;
  return text.replace(final ? SHORTHAND_FINAL : SHORTHAND, (whole, lead: string, word: string) => {
    const day = shorthandDate(word, now);
    return day ? `${lead}@${day}` : whole;
  });
}

/** The first date mention in a line, as a LocalDate (or an instant when it has a time). */
export function firstMention(line: string): LocalDate | Instant | null {
  MENTION.lastIndex = 0;
  const m = MENTION.exec(line);
  MENTION.lastIndex = 0;
  if (!m) return null;
  return m[3] ? atTime(m[2]!, m[3]).toISOString() : m[2]!;
}

/** The local date part of a mention or TaskRef date. */
export const mentionDay = (d: LocalDate | Instant): LocalDate => (d.length === 10 ? d : todayLocal(new Date(d)));

/** Removes date mentions, for showing a checklist line's text next to its date. */
export const stripMentions = (line: string): string => line.replace(MENTION, '$1').replace(/\s{2,}/g, ' ').trim();

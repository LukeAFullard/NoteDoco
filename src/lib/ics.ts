import type { Item, TimeSpan } from '@/data/types';
import { formatRule, parseRule } from './recurrence';
import { addDays } from './time';

/**
 * iCalendar export (TIME-14, RFC 5545): one VEVENT per dated item, with its repeat and
 * reminders as alarms, so the phone's calendar raises alerts even when NoteDoco is closed.
 */

const escape = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Folds lines at 75 octets, as the spec requires (continuation lines start with a space). */
export function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let current = '';
  let size = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    if (size + n > (out.length ? 74 : 75)) {
      out.push(current);
      current = '';
      size = 0;
    }
    current += ch;
    size += n;
  }
  out.push(current);
  return out.join('\r\n ');
}

const utc = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const date = (d: string) => d.replaceAll('-', '');

function times(span: TimeSpan): string[] {
  if (span.allDay) return [`DTSTART;VALUE=DATE:${date(span.start)}`, `DTEND;VALUE=DATE:${date(addDays(span.end ?? span.start, 1))}`];
  const lines = [`DTSTART:${utc(span.start)}`];
  if (span.end) lines.push(`DTEND:${utc(span.end)}`);
  return lines;
}

export function itemToEvent(item: Item, now = new Date()): string[] {
  const span = item.when ?? item.due;
  if (!span) return [];
  const rule = parseRule(item.recurrence);
  const lines = [
    'BEGIN:VEVENT',
    `UID:${item.id}@notedoco`,
    `DTSTAMP:${utc(now.toISOString())}`,
    ...times(span),
    `SUMMARY:${escape((!item.when && item.due ? 'Due: ' : '') + (item.title || 'Untitled'))}`,
  ];
  if (item.preview) lines.push(`DESCRIPTION:${escape(item.preview)}`);
  if (item.tags.length) lines.push(`CATEGORIES:${item.tags.map(escape).join(',')}`);
  if (rule) lines.push(`RRULE:${formatRule(rule, { forIcs: true })}`);
  for (const r of item.reminders) {
    lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escape(item.title || 'Reminder')}`, `TRIGGER;VALUE=DATE-TIME:${utc(r.at)}`, 'END:VALARM');
  }
  lines.push('END:VEVENT');
  return lines;
}

export function toIcs(items: Item[], now = new Date()): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//NoteDoco//NoteDoco 2//EN', 'CALSCALE:GREGORIAN', ...items.flatMap((i) => itemToEvent(i, now)), 'END:VCALENDAR'];
  return lines.map(fold).join('\r\n') + '\r\n';
}

/** A safe file name for an item's .ics. */
export const icsFileName = (title: string) => `${(title || 'event').replace(/[^\p{L}\p{N} _-]+/gu, '').trim().slice(0, 60) || 'event'}.ics`;

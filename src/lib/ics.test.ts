import { fold, icsFileName, toIcs } from './ics';
import type { Item } from '@/data/types';

const base = { id: 'abc', title: 'Dentist, 2nd; floor', preview: 'Bring card', tags: ['health'], reminders: [], recurrence: null, task: null, when: null, due: null } as unknown as Item;

it('writes all-day, timed and due events with repeats and alarms', () => {
  const ics = toIcs(
    [
      { ...base, when: { start: '2026-10-02', end: '2026-10-04', allDay: true, tz: null } },
      { ...base, id: 't', when: { start: '2026-10-02T14:00:00.000Z', end: '2026-10-02T15:30:00.000Z', allDay: false, tz: 'Europe/London' }, recurrence: 'FREQ=WEEKLY;BYDAY=FR;X-NDOCO-MODE=COPY', reminders: [{ id: 'r', at: '2026-10-02T13:50:00.000Z', firedAt: null }] },
      { ...base, id: 'd', title: 'Rent', due: { start: '2026-10-01', end: null, allDay: true, tz: null } },
      { ...base, id: 'none' },
    ],
    new Date('2026-09-26T12:00:00Z'),
  );
  expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
  expect(ics).toContain('DTSTART;VALUE=DATE:20261002\r\nDTEND;VALUE=DATE:20261005');
  expect(ics).toContain('SUMMARY:Dentist\\, 2nd\\; floor');
  expect(ics).toContain('DTSTART:20261002T140000Z\r\nDTEND:20261002T153000Z');
  expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=FR\r\n');
  expect(ics).toContain('TRIGGER;VALUE=DATE-TIME:20261002T135000Z');
  expect(ics).toContain('SUMMARY:Due: Rent');
  expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(3);
  expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
});

it('folds long lines at 75 octets without splitting characters', () => {
  const long = `SUMMARY:${'é'.repeat(60)}`;
  const folded = fold(long);
  for (const line of folded.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  expect(folded.replace(/\r\n /g, '')).toBe(long);
});

it('makes safe file names', () => {
  expect(icsFileName('Dentist: 3pm / Dr. Who?')).toBe('Dentist 3pm  Dr Who.ics');
  expect(icsFileName('')).toBe('event.ics');
});

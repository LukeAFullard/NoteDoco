import { parseCapture, parseNatural } from './naturalDate';

const sat = new Date(2026, 8, 26, 12);

it('reads dates, times and ranges', () => {
  expect(parseNatural('fri 3pm', sat)!.span).toMatchObject({ allDay: false, start: new Date(2026, 9, 2, 15).toISOString() });
  expect(parseNatural('tomorrow', sat)!.span).toEqual({ start: '2026-09-27', end: null, allDay: true, tz: null });
  expect(parseNatural('5-9 oct', sat)!.span).toMatchObject({ start: '2026-10-05', end: '2026-10-09', allDay: true });
  expect(parseNatural('nothing here', sat)).toBeNull();
});

it('reads day-month order outside the US', () => {
  vi.spyOn(navigator, 'language', 'get').mockReturnValue('en-GB');
  expect(parseNatural('12/10', sat)!.span.start).toBe('2026-10-12');
});

it('turns a capture line into text plus dates', () => {
  expect(parseCapture('call Sam on fri at 3pm', sat)).toMatchObject({ text: 'call Sam', due: null, recurrence: null });
  expect(parseCapture('call Sam on fri at 3pm', sat).when!.allDay).toBe(false);
  expect(parseCapture('pay rent by 1 oct', sat)).toMatchObject({ text: 'pay rent', when: null, due: { start: '2026-10-01', allDay: true } });
  expect(parseCapture('weekly review every friday', sat)).toMatchObject({ text: 'weekly review', when: { start: '2026-10-02' }, recurrence: 'FREQ=WEEKLY;BYDAY=FR' });
  expect(parseCapture('water plants every day', sat)).toMatchObject({ text: 'water plants', when: { start: '2026-09-26' }, recurrence: 'FREQ=DAILY' });
  expect(parseCapture('just an idea', sat)).toEqual({ text: 'just an idea', when: null, due: null, recurrence: null });
  // Everyday words aren't taken as dates inside a sentence.
  expect(parseCapture('market stall at the weekend', sat)).toMatchObject({ text: 'market stall at the weekend', when: null });
  expect(parseCapture('I may go', sat)).toMatchObject({ text: 'I may go', when: null });
});

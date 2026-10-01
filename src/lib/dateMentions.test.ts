import { firstMention, resolveDateMentions, shorthandDate, stripMentions } from './dateMentions';

const sat = new Date(2026, 8, 26, 12); // Saturday

it('reads shorthand dates, with weekdays meaning the next one', () => {
  expect(shorthandDate('today', sat)).toBe('2026-09-26');
  expect(shorthandDate('tomorrow', sat)).toBe('2026-09-27');
  expect(shorthandDate('fri', sat)).toBe('2026-10-02');
  expect(shorthandDate('Saturday', sat)).toBe('2026-10-03');
  expect(shorthandDate('mon', sat)).toBe('2026-09-28');
  expect(shorthandDate('next-week', sat)).toBe('2026-09-28');
  expect(shorthandDate('sam', sat)).toBeNull();
});

it('rewrites finished shorthand to ISO dates and leaves other @words alone', () => {
  expect(resolveDateMentions('- [ ] call @fri about it', sat)).toBe('- [ ] call @2026-10-02 about it');
  expect(resolveDateMentions('ask @sam @tomorrow.', sat)).toBe('ask @sam @2026-09-27.');
  expect(resolveDateMentions('still typing @fri', sat)).toBe('still typing @fri');
  expect(resolveDateMentions('finished @fri', sat, { final: true })).toBe('finished @2026-10-02');
  expect(resolveDateMentions('still typing @fr', sat)).toBe('still typing @fr');
  expect(resolveDateMentions('email me@fri.com', sat)).toBe('email me@fri.com');
});

it('finds the first mention and strips mentions', () => {
  expect(firstMention('book venue @2026-10-02 and @2026-10-05')).toBe('2026-10-02');
  expect(firstMention('call @2026-10-02T15:30')).toBe(new Date(2026, 9, 2, 15, 30).toISOString());
  expect(firstMention('no date')).toBeNull();
  expect(stripMentions('book venue @2026-10-02 now')).toBe('book venue now');
});

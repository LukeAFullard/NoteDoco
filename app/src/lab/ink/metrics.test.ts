import { InkMetrics, percentile } from './metrics';

it('computes percentiles', () => {
  expect(percentile([], 50)).toBeNull();
  expect(percentile([5, 1, 3, 2, 4], 50)).toBe(3);
  expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 95)).toBe(10);
});

it('summarises sample rates and skips strokes too short to measure', () => {
  const m = new InkMetrics();
  m.noteStroke(240, 60, 1000);
  m.noteStroke(3, 3, 50);
  expect(m.summary()).toMatchObject({ penSampleRateHz: 240, moveEventsPerSec: 60 });
});

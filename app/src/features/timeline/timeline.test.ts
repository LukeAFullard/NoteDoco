import { dateAtPos, dayAtPos, makeScale, posOfDate, posOfDay, spanExtent, ticks, zoomBy } from './scale';
import { density, laneKeysFor, orderLanes, packLane, type Entry } from './layout';
import { allDaySpan, timedSpan } from '@/lib/time';
import type { Item } from '@/data/types';

describe('scale', () => {
  const s = makeScale('day', '2026-09-26');

  it('maps days and moments to positions and back', () => {
    expect(posOfDay(s, '2026-09-26')).toBe(370 * 160);
    expect(dayAtPos(s, posOfDay(s, '2026-10-02') + 10)).toBe('2026-10-02');
    const t = new Date(2026, 8, 26, 12);
    expect(posOfDate(s, t)).toBe(370 * 160 + 80);
    expect(dateAtPos(s, posOfDate(s, t)).getTime()).toBe(t.getTime());
  });

  it('gives every local day the same width, even across a daylight-saving change', () => {
    const w = makeScale('hour', '2026-03-29');
    const noon = (d: number) => posOfDate(w, new Date(2026, 2, d, 12));
    expect(noon(30) - noon(29)).toBe(1440);
    expect(noon(29) - noon(28)).toBe(1440);
  });

  it('measures spans: all-day ranges cover whole days', () => {
    expect(spanExtent(s, allDaySpan('2026-09-26', '2026-09-27'))).toEqual([370 * 160, 372 * 160]);
    const [a, b] = spanExtent(s, timedSpan(new Date(2026, 8, 26, 6), new Date(2026, 8, 26, 18)));
    expect(b - a).toBe(80);
  });

  it('labels ticks for the zoom level', () => {
    const t = ticks(s, posOfDay(s, '2026-09-29'), posOfDay(s, '2026-10-02'));
    expect(t.minor).toHaveLength(4);
    expect(t.major.map((m) => m.day)).toEqual(['2026-09-29', '2026-10-01']);
    expect(t.minor.find((m) => m.day === '2026-10-03')).toBeUndefined();
    const y = makeScale('year', '2026-09-26');
    expect(ticks(y, posOfDay(y, '2026-01-01'), posOfDay(y, '2026-12-31')).minor).toHaveLength(12);
  });

  it('zooms in and out, stopping at the ends', () => {
    expect(zoomBy('day', 1)).toBe('week');
    expect(zoomBy('hour', -1)).toBe('hour');
    expect(zoomBy('year', 1)).toBe('year');
  });
});

describe('layout', () => {
  const e = (key: string, a: number, b: number): Entry => ({ key, a, b, lane: 'l', placed: null as never });

  it('packs overlapping entries into rows', () => {
    const p = packLane([e('a', 0, 100), e('b', 50, 150), e('c', 110, 200), e('d', 160, 300)], 3);
    expect(Object.fromEntries(p.entries.map((x) => [x.key, x.row]))).toEqual({ a: 0, b: 1, c: 0, d: 1 });
    expect(p.rows).toBe(2);
  });

  it('collapses entries past the row limit into +N pills', () => {
    const p = packLane([e('a', 0, 100), e('b', 0, 100), e('c', 10, 100), e('d', 20, 100)], 2);
    expect(p.entries.map((x) => x.key)).toEqual(['a', 'b']);
    expect(p.clusters).toEqual([{ lane: 'l', pos: 0, count: 2, keys: ['c', 'd'] }]);
    expect(p.rows).toBe(3);
  });

  it('counts density per bucket', () => {
    expect([...density([e('a', 0, 250), e('b', 90, 95)], 100)]).toEqual([[0, 2], [1, 1], [2, 1]]);
  });

  it('puts items in lanes by group, tag, kind or colour', () => {
    const item = { groupId: null, tags: ['work', 'q4'], kind: 'sticky', colour: 'mint' } as unknown as Item;
    expect(laneKeysFor(item, 'group')).toEqual(['inbox']);
    expect(laneKeysFor(item, 'tag')).toEqual(['work', 'q4']);
    expect(laneKeysFor(item, 'kind')).toEqual(['sticky']);
    expect(laneKeysFor(item, 'colour')).toEqual(['mint']);
  });

  it('orders and hides lanes', () => {
    const lanes = ['a', 'b', 'c', 'd'].map((key) => ({ key, label: key, colour: null, depth: 0 }));
    expect(orderLanes(lanes, ['c', 'a'], ['b']).map((l) => l.key)).toEqual(['c', 'a', 'd']);
  });
});

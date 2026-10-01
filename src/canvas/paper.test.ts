import { boundsOfPages, ENDLESS_ROOM, layoutPages, PAGE_GAP, PAGE_SIZES, pageAt } from './paper';
import type { Paper } from '@/data/types';

const a4: Paper = { size: 'a4', template: 'blank', colour: 'white' };
const letter: Paper = { size: 'letter', template: 'lined', colour: 'cream' };
const endless: Paper = { size: 'endless', template: 'dot', colour: 'dark' };

describe('page layout', () => {
  it('stacks pages centred on x = 0 with a gap', () => {
    const boxes = layoutPages([
      { id: 'a', paper: a4 },
      { id: 'b', paper: letter },
    ]);
    expect(boxes[0]).toMatchObject({ x: -397, y: 0, w: 794, h: 1123 });
    expect(boxes[1]).toMatchObject({ x: -408, y: 1123 + PAGE_GAP, w: PAGE_SIZES.letter.w, h: PAGE_SIZES.letter.h });
    expect(boundsOfPages(boxes)).toEqual({ minX: -408, minY: 0, maxX: 408, maxY: 1123 + PAGE_GAP + 1056 });
  });

  it('grows endless pages with their content', () => {
    expect(layoutPages([{ id: 'e', paper: endless }])[0]!.h).toBe(1123);
    expect(layoutPages([{ id: 'e', paper: endless }], () => 2000)[0]!.h).toBe(2000 + ENDLESS_ROOM);
  });

  it('finds the page under a point, or the nearest one', () => {
    const boxes = layoutPages([
      { id: 'a', paper: a4 },
      { id: 'b', paper: a4 },
    ]);
    expect(pageAt(boxes, 0, 10)?.id).toBe('a');
    expect(pageAt(boxes, 0, 1123 + 40)?.id).toBe('b');
    expect(pageAt(boxes, 0, 1123 + 5)?.id).toBe('a'); // in the gap, nearer the first page
    expect(pageAt(boxes, -2000, 1500)?.id).toBe('b');
    expect(pageAt([], 0, 0)).toBeNull();
  });
});

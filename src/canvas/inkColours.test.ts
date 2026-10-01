import { contrastRatio } from '@/lib/contrast';
import { INK_COLOURS, PAPER_COLOURS, PEN_COLOUR_KEYS, resolveInk } from './inkColours';

describe('ink colours', () => {
  it.each(['white', 'cream', 'dark'] as const)('pen ink stands out from %s paper (≥ 3:1)', (paper) => {
    for (const key of PEN_COLOUR_KEYS) {
      expect(contrastRatio(resolveInk(key, paper), PAPER_COLOURS[paper].paper), `${key} on ${paper}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('switches to the dark-paper shade and keeps custom colours', () => {
    expect(resolveInk('blue', 'white')).toBe(INK_COLOURS.blue.light);
    expect(resolveInk('blue', 'dark')).toBe(INK_COLOURS.blue.dark);
    expect(resolveInk('#123456', 'dark')).toBe('#123456');
    expect(resolveInk('no-such-colour', 'white')).toBe(INK_COLOURS.black.light);
  });

  it('keeps template lines visible but quieter than ink', () => {
    for (const p of Object.values(PAPER_COLOURS)) {
      expect(contrastRatio(p.rule, p.paper)).toBeGreaterThan(1.3);
      expect(contrastRatio(p.rule, p.paper)).toBeLessThan(3);
      expect(contrastRatio(p.label, p.paper)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

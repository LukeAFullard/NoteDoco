import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { COLOUR_KEYS, PALETTE, STICKY_INK, nextColour } from './palette';
import { contrastRatio } from './contrast';

const css = readFileSync(resolve(__dirname, '../styles.css'), 'utf8');
const [lightCss, darkCss] = css.split('.dark {') as [string, string];

describe('content palette', () => {
  it.each(['light', 'dark'] as const)('keeps sticky text readable (≥ 7:1, WCAG AAA) in %s mode', (mode) => {
    for (const key of COLOUR_KEYS) {
      expect(contrastRatio(STICKY_INK, PALETTE[mode][key]), `${mode}/${key}`).toBeGreaterThanOrEqual(7);
    }
  });

  it('matches the CSS custom properties', () => {
    for (const key of COLOUR_KEYS) {
      expect(lightCss).toContain(`--sticky-${key}: ${PALETTE.light[key]};`);
      expect(darkCss).toContain(`--sticky-${key}: ${PALETTE.dark[key]};`);
    }
  });

  it('cycles colours', () => {
    expect(nextColour(null)).toBe('lemon');
    expect(nextColour('lemon')).toBe('apricot');
    expect(nextColour('slate')).toBe('lemon');
  });
});

describe('UI tokens', () => {
  const token = (block: string, name: string) => block.match(new RegExp(`--nd-${name}: (#[0-9a-f]{6});`))![1]!;
  it.each([
    ['light', lightCss],
    ['dark', darkCss],
  ])('meet WCAG AA for text in %s mode', (_mode, block) => {
    for (const fg of ['text', 'muted', 'accent', 'danger', 'success']) {
      for (const bg of ['bg', 'surface']) {
        expect(contrastRatio(token(block, fg), token(block, bg)), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    }
    expect(contrastRatio(token(block, 'on-accent'), token(block, 'accent-fill'))).toBeGreaterThanOrEqual(4.5);
  });
});

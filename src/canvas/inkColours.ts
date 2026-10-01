import type { Paper } from '@/data/types';

/**
 * Ink and paper colours. Strokes store a palette key ("blue"), not a colour, so ink stays
 * readable when a page uses dark paper: each key has a light-paper and a dark-paper value.
 * Custom colours are stored as "#rrggbb" and drawn as they are.
 * Contrast is tested in inkColours.test.ts (ink ≥ 3:1 against every paper).
 */
export const PEN_COLOUR_KEYS = ['black', 'blue', 'red', 'green', 'purple', 'orange'] as const;
export const HIGHLIGHTER_COLOUR_KEYS = ['yellow', 'mint', 'pink', 'sky', 'peach'] as const;
export type PenColourKey = (typeof PEN_COLOUR_KEYS)[number];
export type HighlighterColourKey = (typeof HIGHLIGHTER_COLOUR_KEYS)[number];
export type InkColourKey = PenColourKey | HighlighterColourKey;

export const INK_COLOURS: Record<InkColourKey, { light: string; dark: string; label: string }> = {
  black: { light: '#1c1f22', dark: '#e8eaed', label: 'Black' },
  blue: { light: '#1f5fbf', dark: '#8fb8ff', label: 'Blue' },
  red: { light: '#c62828', dark: '#ff8a80', label: 'Red' },
  green: { light: '#2e7d32', dark: '#81c995', label: 'Green' },
  purple: { light: '#6a3fb5', dark: '#c4a7ff', label: 'Purple' },
  orange: { light: '#b45309', dark: '#ffb067', label: 'Orange' },
  yellow: { light: '#ffe14d', dark: '#ffe14d', label: 'Yellow' },
  mint: { light: '#7ee08a', dark: '#7ee08a', label: 'Mint' },
  pink: { light: '#ff8ccf', dark: '#ff8ccf', label: 'Pink' },
  sky: { light: '#7cc6ff', dark: '#7cc6ff', label: 'Sky' },
  peach: { light: '#ffb35c', dark: '#ffb35c', label: 'Peach' },
};

export const PAPER_COLOURS: Record<Paper['colour'], { paper: string; rule: string; margin: string; faint: string; label: string }> = {
  white: { paper: '#ffffff', rule: '#c5d2df', margin: '#e3a0a0', faint: '#e6ecf2', label: '#5f6b77' },
  cream: { paper: '#faf5e8', rule: '#d5c9ae', margin: '#dda38c', faint: '#ece4d1', label: '#665d4d' },
  dark: { paper: '#1f2328', rule: '#3d464f', margin: '#704848', faint: '#2b3137', label: '#a1abb5' },
};

export const PAPER_COLOUR_LABELS: Record<Paper['colour'], string> = { white: 'White', cream: 'Cream', dark: 'Dark' };

const isHex = (c: string) => /^#[0-9a-f]{6}$/i.test(c);

/** The colour to draw a stored ink colour with on the given paper. */
export function resolveInk(colour: string, paper: Paper['colour']): string {
  if (isHex(colour)) return colour;
  const c = INK_COLOURS[colour as InkColourKey] ?? INK_COLOURS.black;
  return paper === 'dark' ? c.dark : c.light;
}

export const inkLabel = (colour: string) => (isHex(colour) ? 'Custom colour' : (INK_COLOURS[colour as InkColourKey]?.label ?? 'Black'));

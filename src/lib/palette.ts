/** The content palette for stickies and groups. Keep in sync with src/styles.css. */
export const COLOUR_KEYS = ['lemon', 'apricot', 'coral', 'lilac', 'sky', 'mint', 'sand', 'slate'] as const;
export type ColourKey = (typeof COLOUR_KEYS)[number];

export const STICKY_INK = '#1c1f22';

export const PALETTE: Record<'light' | 'dark', Record<ColourKey, string>> = {
  light: {
    lemon: '#ffe98a',
    apricot: '#ffc98a',
    coral: '#ffa8a0',
    lilac: '#d9c2f5',
    sky: '#a9d4f5',
    mint: '#aee5c8',
    sand: '#e9dcc4',
    slate: '#cbd3da',
  },
  dark: {
    lemon: '#e6cf6e',
    apricot: '#e6ae70',
    coral: '#e89a93',
    lilac: '#bba4da',
    sky: '#8db8da',
    mint: '#92c9ac',
    sand: '#cdbfa7',
    slate: '#aeb7bf',
  },
};

export const COLOUR_LABELS: Record<ColourKey, string> = {
  lemon: 'Lemon',
  apricot: 'Apricot',
  coral: 'Coral',
  lilac: 'Lilac',
  sky: 'Sky',
  mint: 'Mint',
  sand: 'Sand',
  slate: 'Slate',
};

/** JSON Canvas preset colours ("1" red … "6" purple); colours without a preset export as hex. */
export const JSON_CANVAS_PRESET: Partial<Record<ColourKey, string>> = {
  coral: '1',
  apricot: '2',
  lemon: '3',
  mint: '4',
  sky: '5',
  lilac: '6',
};

/** Cycles through colours so a burst of new stickies isn't all one colour. */
export function nextColour(previous: ColourKey | null | undefined): ColourKey {
  if (!previous) return 'lemon';
  const i = COLOUR_KEYS.indexOf(previous);
  return COLOUR_KEYS[(i + 1) % COLOUR_KEYS.length]!;
}

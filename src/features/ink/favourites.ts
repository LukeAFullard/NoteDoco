import type { PenTool } from '@/canvas/strokeStyle';
import { inkLabel } from '@/canvas/inkColours';
import { sizeLabel } from './tools';

/** A favourite pen (INK-5): one tap sets tool, colour and thickness. */
export interface Favourite {
  tool: PenTool;
  colour: string;
  size: number;
}

export const MAX_FAVOURITES = 6;

export const DEFAULT_FAVOURITES: Favourite[] = [
  { tool: 'ballpoint', colour: 'black', size: 1 },
  { tool: 'ballpoint', colour: 'blue', size: 1 },
  { tool: 'fountain', colour: 'red', size: 1 },
  { tool: 'highlighter', colour: 'yellow', size: 1 },
];

const TOOL_NAMES: Record<PenTool, string> = { ballpoint: 'ballpoint', fountain: 'fountain pen', marker: 'marker', highlighter: 'highlighter' };

export const favouriteLabel = (f: Favourite) => `${inkLabel(f.colour)} ${TOOL_NAMES[f.tool]}, ${sizeLabel(f.size).toLowerCase()}`;

export const sameFavourite = (a: Favourite, b: Favourite) => a.tool === b.tool && a.colour === b.colour && a.size === b.size;

/** Adds a pen (no duplicates); the oldest goes when the bar is full. */
export function addFavourite(list: Favourite[], f: Favourite): Favourite[] {
  if (list.some((x) => sameFavourite(x, f))) return list;
  return [...list, f].slice(-MAX_FAVOURITES);
}

export const removeFavourite = (list: Favourite[], i: number) => list.filter((_, k) => k !== i);

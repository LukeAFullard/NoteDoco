import type { ColourKey } from '@/lib/palette';
import { useSetting, setSetting } from '@/data/repos/settings';

/** What each sticky colour means to this user, e.g. yellow = idea (STK-5). Blank = no meaning. */
export type ColourMeanings = Partial<Record<ColourKey, string>>;

const KEY = 'colourMeanings';
export const useColourMeanings = () => useSetting<ColourMeanings>(KEY, {});
export const saveColourMeanings = (m: ColourMeanings) => setSetting(KEY, m);

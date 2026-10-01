import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing';

/**
 * Fractional order keys: reordering touches only the moved record, and two devices
 * reordering never renumber each other's items (sync-friendly).
 */
export const orderBetween = (before: string | null, after: string | null): string =>
  generateKeyBetween(before, after);

export const orderAfter = (last: string | null): string => generateKeyBetween(last, null);

export const ordersBetween = (before: string | null, after: string | null, n: number): string[] =>
  generateNKeysBetween(before, after, n);

/** Compares order keys the way they are meant to sort (plain code-unit order, not locale order). */
export const compareOrder = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

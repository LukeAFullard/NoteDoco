/** A stable small tilt per sticky (-1.6°…1.6°), so a wall looks pinned-up rather than printed. */
export function tiltFor(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((Math.abs(h) % 33) - 16) / 10;
}

/** Sizes step down on phones so two medium stickies fit side by side. */
export const STICKY_SIZES = {
  S: 'w-32 min-h-32 sm:w-36 sm:min-h-36',
  M: 'w-40 min-h-40 sm:w-48 sm:min-h-48',
  L: 'w-56 min-h-56 sm:w-64 sm:min-h-64',
} as const;

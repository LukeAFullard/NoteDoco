/** A stable small tilt per sticky (-1.6°…1.6°), so a wall looks pinned-up rather than printed. */
export function tiltFor(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((Math.abs(h) % 33) - 16) / 10;
}

export const STICKY_SIZES = { S: 'w-36 min-h-36', M: 'w-48 min-h-48', L: 'w-64 min-h-64' } as const;

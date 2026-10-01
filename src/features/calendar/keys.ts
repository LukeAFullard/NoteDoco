import type { KeyboardEvent } from 'react';
import type { Placed } from '@/data/agenda';

/** Alt+arrow keys on a calendar entry: left/right a day, up/down `vertical` days. */
export function keyMoveHandler(p: Placed, onKeyMove: (p: Placed, days: number) => void, vertical: number) {
  return (e: KeyboardEvent) => {
    if (!e.altKey) return;
    const days = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowDown' ? vertical : e.key === 'ArrowUp' ? -vertical : 0;
    if (!days) return;
    e.preventDefault();
    onKeyMove(p, days);
  };
}


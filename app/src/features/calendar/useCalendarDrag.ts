import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { Placed } from '@/data/agenda';
import type { LocalDate } from '@/data/types';

/** Where something was dropped: a day, and for the week's time grid, minutes after midnight. */
export interface CalendarDrop {
  day: LocalDate;
  minutes: number | null;
}

export interface CalendarDragStart {
  placed: Placed;
  /** The day cell (or column) the drag started from. */
  fromDay: LocalDate;
  kind: 'move' | 'end';
  /** For timed entries: minutes between the entry's start and the grab point. */
  grabMinutes: number;
}

interface Active extends CalendarDragStart {
  pointerId: number;
  x0: number;
  y0: number;
  x: number;
  y: number;
  moved: boolean;
}

/**
 * Pointer dragging for the calendar (mouse and pen; on touch, a tap opens the item and dates
 * are changed in the date dialog). Drop targets are elements with `data-cal-day`; time grids
 * also set `data-cal-px-per-min`.
 */
export function useCalendarDrag(onDrop: (start: CalendarDragStart, to: CalendarDrop) => void) {
  const [active, setActive] = useState<Active | null>(null);
  /** When the last drag ended, so the click that follows it doesn't open the item. */
  const endedAt = useRef(0);

  useEffect(() => {
    if (!active) return;
    const move = (e: PointerEvent) => {
      if (e.pointerId !== active.pointerId) return;
      const moved = active.moved || Math.hypot(e.clientX - active.x0, e.clientY - active.y0) > 5;
      setActive({ ...active, x: e.clientX, y: e.clientY, moved });
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== active.pointerId) return;
      setActive(null);
      if (!active.moved) return;
      endedAt.current = Date.now();
      const target = document.elementsFromPoint(e.clientX, e.clientY).find((el) => el instanceof HTMLElement && el.dataset.calDay) as HTMLElement | undefined;
      if (!target) return;
      const perMin = Number(target.dataset.calPxPerMin);
      const minutes = perMin ? (e.clientY - target.getBoundingClientRect().top) / perMin : null;
      onDrop(active, { day: target.dataset.calDay!, minutes });
    };
    const cancel = (e: PointerEvent) => e.pointerId === active.pointerId && setActive(null);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
    };
  }, [active, onDrop]);

  const start = (e: ReactPointerEvent, s: CalendarDragStart) => {
    if (e.button !== 0 || e.pointerType === 'touch') return;
    e.stopPropagation();
    setActive({ ...s, pointerId: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, moved: false });
  };

  return { start, dragging: active?.moved ? active : null, justDragged: () => Date.now() - endedAt.current < 300 };
}

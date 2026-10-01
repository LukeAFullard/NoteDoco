import { ArrowDown, ArrowUp } from 'lucide-react';
import { Button, IconButton } from '@/design/Button';
import { Dialog } from '@/design/Dialog';
import type { Lane } from './layout';
import { orderLanes, LANE_MODE_LABELS } from './layout';
import { setView, useTimeline } from './store';

/** Choose, reorder and show or hide lanes for the current lane mode (TIME-3). */
export function LanePicker({ lanes, onClose }: { lanes: Lane[]; onClose: () => void }) {
  const { laneMode, order, hidden } = useTimeline();
  const hiddenNow = hidden[laneMode] ?? [];
  const ordered = orderLanes(lanes, order[laneMode] ?? [], []);
  const keys = ordered.map((l) => l.key);

  const move = (i: number, dir: -1 | 1) => {
    const next = [...keys];
    [next[i], next[i + dir]] = [next[i + dir]!, next[i]!];
    setView({ order: { ...order, [laneMode]: next } });
  };
  const toggle = (key: string) =>
    setView({ hidden: { ...hidden, [laneMode]: hiddenNow.includes(key) ? hiddenNow.filter((k) => k !== key) : [...hiddenNow, key] } });

  return (
    <Dialog isOpen onOpenChange={(o) => !o && onClose()} title={`Lanes: ${LANE_MODE_LABELS[laneMode]}`}>
      <div className="p-5 pt-3">
        <p className="mb-3 text-sm text-muted">Tick the lanes to show, and use the arrows to put them in order.</p>
        <ul className="max-h-[50vh] space-y-1 overflow-y-auto">
          {ordered.map((l, i) => (
            <li key={l.key} className="flex items-center gap-2 rounded-panel px-2 py-1 hover:bg-surface-2">
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-sm" style={{ paddingLeft: l.depth * 12 }}>
                <input type="checkbox" checked={!hiddenNow.includes(l.key)} onChange={() => toggle(l.key)} className="h-4 w-4 accent-[var(--color-accent-fill)]" />
                {l.colour && <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full border border-black/10" style={{ background: `var(--sticky-${l.colour})` }} />}
                <span className="truncate">{l.label}</span>
              </label>
              <IconButton label={`Move ${l.label} up`} size="sm" isDisabled={i === 0} onPress={() => move(i, -1)}>
                <ArrowUp size={15} />
              </IconButton>
              <IconButton label={`Move ${l.label} down`} size="sm" isDisabled={i === ordered.length - 1} onPress={() => move(i, 1)}>
                <ArrowDown size={15} />
              </IconButton>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onPress={() => setView({ order: { ...order, [laneMode]: [] }, hidden: { ...hidden, [laneMode]: [] } })}>
            Reset
          </Button>
          <Button variant="primary" onPress={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

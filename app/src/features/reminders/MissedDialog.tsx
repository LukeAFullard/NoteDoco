import { useNavigate } from 'react-router';
import { BellRing } from 'lucide-react';
import { Button } from '@/design/Button';
import { Dialog } from '@/design/Dialog';
import { formatDateTime } from '@/lib/dates';
import { itemTitle } from '@/features/items/kinds';
import { openSticky } from '@/features/stickies/stickyDialog';
import { clearMissed, useMissed } from './store';

/** Reminders that were due while NoteDoco was closed (TIME-13). */
export function MissedDialog() {
  const missed = useMissed((s) => s.missed);
  const navigate = useNavigate();
  if (!missed.length) return null;
  return (
    <Dialog isOpen onOpenChange={(o) => !o && clearMissed()} title="While you were away">
      <div className="p-5 pt-2">
        <p className="mb-3 text-sm text-muted">
          {missed.length === 1 ? 'This reminder' : `These ${missed.length} reminders`} went off while NoteDoco was closed. For alerts you can’t miss, add important items to your calendar.
        </p>
        <ul className="space-y-1">
          {missed.map((p) => (
            <li key={p.reminder.id}>
              <button
                type="button"
                onClick={() => {
                  clearMissed();
                  if (p.item.kind === 'sticky') openSticky(p.item.id);
                  else navigate(`/items/${p.item.id}`);
                }}
                className="flex w-full items-center gap-3 rounded-panel px-2 py-2 text-left hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-focus"
              >
                <BellRing size={16} className="shrink-0 text-accent" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{itemTitle(p.item.title, p.item.kind)}</span>
                  <span className="block text-xs text-muted">Due to remind you {formatDateTime(p.reminder.at)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-end">
          <Button variant="primary" onPress={clearMissed}>
            Got it
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

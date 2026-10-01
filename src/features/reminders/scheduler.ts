import { liveQuery } from 'dexie';
import { markFired, pendingReminders, type PendingReminder } from '@/data/repos/reminders';
import { overdueItems } from '@/data/agenda';
import { showToast } from '@/design/toast';
import { formatSpan, itemSpan } from '@/lib/time';
import { showSystemNotification } from './notify';
import { useMissed } from './store';

/**
 * Reminders while NoteDoco is open or in the background (TIME-13). A timer is set for the next
 * reminder and re-set whenever the data changes. Reminders due while the app was closed are
 * collected into "While you were away" instead of firing all at once.
 */

/** Reminders up to this late still fire as normal. */
const GRACE_MS = 2 * 60_000;
/** Timers longer than this are re-checked (browsers cap timeouts, and clocks change). */
const MAX_WAIT_MS = 60 * 60_000;

let timer = 0;
let started = false;
let firstCheck = true;
let checking: Promise<void> | null = null;

function describe(p: PendingReminder): string {
  const span = itemSpan(p.item);
  return span ? formatSpan(span) : 'Reminder';
}

async function fire(p: PendingReminder) {
  const title = p.item.title || 'Reminder';
  const hash = `#/items/${p.item.id}`;
  await showSystemNotification(title, describe(p), hash, p.reminder.id);
  showToast({ message: `Reminder: ${title}`, action: { label: 'Open', run: () => void (location.hash = hash) } }, 15_000);
}

async function check() {
  const list = await pendingReminders();
  const now = Date.now();
  const due = list.filter((p) => Date.parse(p.reminder.at) <= now);
  if (due.length) {
    const late = due.filter((p) => firstCheck && now - Date.parse(p.reminder.at) > GRACE_MS);
    const onTime = due.filter((p) => !late.includes(p));
    await markFired(due.map((p) => ({ itemId: p.item.id, reminderId: p.reminder.id })));
    if (late.length) useMissed.setState((s) => ({ missed: [...s.missed, ...late] }));
    for (const p of onTime) await fire(p);
  }
  firstCheck = false;
  clearTimeout(timer);
  const next = list.find((p) => Date.parse(p.reminder.at) > now);
  if (next) timer = window.setTimeout(() => void run(), Math.min(MAX_WAIT_MS, Date.parse(next.reminder.at) - now + 50));
}

/** Runs one check at a time; a change during a check runs another afterwards. */
function run(): Promise<void> {
  checking = (checking ?? Promise.resolve()).then(check).catch(() => undefined);
  return checking;
}

/** Keeps the app icon's badge at the number of overdue items, where supported. */
function watchBadge() {
  const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
  if (!nav.setAppBadge) return;
  liveQuery(overdueItems).subscribe((items) => {
    void (items.length ? nav.setAppBadge!(items.length) : nav.clearAppBadge?.())?.catch(() => undefined);
  });
}

export function startReminders() {
  if (started) return;
  started = true;
  liveQuery(pendingReminders).subscribe(() => void run());
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void run());
  watchBadge();
}

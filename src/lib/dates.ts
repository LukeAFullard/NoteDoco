const rtf = () => new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

/** "just now", "5 min ago", "yesterday", "3 Oct" — for edited/created stamps on cards. */
export function formatRelative(iso: string, now = new Date()): string {
  const then = new Date(iso);
  const secs = Math.round((then.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(secs);
  if (abs < 45) return 'just now';
  if (abs < 3600) return rtf().format(Math.round(secs / 60), 'minute');
  if (abs < 86_400 && then.getDate() === now.getDate()) return rtf().format(Math.round(secs / 3600), 'hour');
  const days = Math.round((startOfDay(then) - startOfDay(now)) / 86_400_000);
  if (Math.abs(days) < 7) return rtf().format(days, 'day');
  const sameYear = then.getFullYear() === now.getFullYear();
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) }).format(then);
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}

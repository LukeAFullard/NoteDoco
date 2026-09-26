import { CalendarDays } from 'lucide-react';
import { Pane } from '@/app/Pane';
import { EmptyState } from '@/design/EmptyState';

export function TodayPage() {
  const date = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  return (
    <Pane title="Today">
      <p className="px-4 pt-4 font-mono text-sm text-muted">{date}</p>
      <EmptyState
        icon={<CalendarDays size={32} />}
        title="Your day will live here"
        body="Today's agenda, due items and pinned stickies arrive in Phase 2. For now, create a group or try the Ink lab."
      />
    </Pane>
  );
}

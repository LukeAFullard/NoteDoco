import { Inbox } from 'lucide-react';
import { Pane } from '@/app/Pane';
import { EmptyState } from '@/design/EmptyState';
import { useItems } from '@/data/hooks';

export function InboxPage() {
  const items = useItems(null);
  return (
    <Pane title="Inbox">
      {items && items.length > 0 ? (
        <ul className="divide-y divide-border">
          {items.map((i) => (
            <li key={i.id} className="px-4 py-3 text-sm">
              {i.title || 'Untitled'}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={<Inbox size={32} />}
          title="Nothing waiting"
          body="Quick captures that aren't filed yet land here, so you never have to decide where something goes up front. Notes and stickies arrive in Phase 1."
        />
      )}
    </Pane>
  );
}

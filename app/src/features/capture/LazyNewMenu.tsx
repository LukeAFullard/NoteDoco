import { lazy, Suspense, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/design/Button';

const NewMenu = lazy(() => import('./NewMenu').then((m) => ({ default: m.NewMenu })));

/**
 * The "+ New" button for always-visible places (sidebar, phone bar). The menu code loads on
 * first press, keeping it out of the startup bundle; after that it's the real menu.
 */
export function LazyNewMenu({ className, compact }: { className?: string; compact?: boolean }) {
  const [loaded, setLoaded] = useState(false);
  const placeholder = (
    <Button variant="primary" size="sm" className={className} aria-label="New" onPress={() => setLoaded(true)}>
      <Plus size={16} aria-hidden /> {!compact && 'New'}
    </Button>
  );
  if (!loaded) return placeholder;
  return (
    <Suspense fallback={placeholder}>
      <NewMenu className={className} compact={compact} defaultOpen />
    </Suspense>
  );
}

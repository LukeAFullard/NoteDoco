import { useState } from 'react';
import { AlertTriangle, Share, X } from 'lucide-react';
import { useStorageHealth } from '@/data/health';
import { readPref, writePref } from '@/lib/localPref';
import { needsHomeScreenInstall } from './durability';

/** Shown when storage can't be opened. There is no silent in-memory fallback. */
export function StorageBanner() {
  const health = useStorageHealth();
  if (health.status !== 'failed') return null;
  return (
    <div role="alert" className="flex items-center gap-3 bg-danger px-4 py-2.5 text-sm text-bg">
      <AlertTriangle size={16} aria-hidden />
      <span className="flex-1">{health.message}</span>
      <button type="button" className="font-semibold underline" onClick={() => location.reload()}>
        Reload
      </button>
    </div>
  );
}

/** iPhone/iPad only: Safari can delete a site's data after 7 days unused unless it's on the Home Screen. */
export function InstallGuide() {
  const [dismissed, setDismissed] = useState(() => readPref('installGuideDismissed', false));
  if (dismissed || !needsHomeScreenInstall()) return null;
  return (
    <div className="flex items-start gap-3 border-b border-border bg-accent-soft px-4 py-2.5 text-sm">
      <Share size={16} aria-hidden className="mt-0.5 shrink-0 text-accent" />
      <p className="flex-1">
        <strong>Keep your notes safe:</strong> tap <em>Share</em> → <em>Add to Home Screen</em>. Otherwise Safari may delete
        NoteDoco’s data if you don’t open it for 7 days.
      </p>
      <button
        type="button"
        aria-label="Dismiss"
        className="text-muted hover:text-text"
        onClick={() => {
          writePref('installGuideDismissed', true);
          setDismissed(true);
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
}

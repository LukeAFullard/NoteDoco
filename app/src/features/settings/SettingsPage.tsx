import { useEffect, useState, type ReactNode } from 'react';
import { Radio, RadioGroup } from 'react-aria-components';
import { ExternalLink, ShieldCheck, ShieldAlert } from 'lucide-react';
import { Pane } from '@/app/Pane';
import { Button } from '@/design/Button';
import { setTheme, useTheme, type Theme } from '@/app/theme';
import { formatBytes, getStorageStatus, requestPersistence, type StorageStatus } from '@/app/durability';
import { useStorageHealth } from '@/data/health';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-border px-4 py-5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
      {children}
    </section>
  );
}

const THEMES: Array<{ value: Theme; label: string }> = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'Match system' },
];

function StorageSection() {
  const [status, setStatus] = useState<StorageStatus | null>(null);
  const health = useStorageHealth();
  const refresh = () => void getStorageStatus().then(setStatus);
  useEffect(refresh, []);

  const pct = status?.usage != null && status.quota ? Math.min(100, (status.usage / status.quota) * 100) : 0;
  return (
    <Section title="Data & storage">
      <div className="space-y-4 text-sm">
        <p>
          Everything is stored on this device only. Nothing is uploaded. Storage:{' '}
          <strong>{health.status === 'ok' ? 'working' : health.status === 'opening' ? 'opening…' : 'unavailable'}</strong>
        </p>
        {status?.supported ? (
          <>
            <div>
              <div className="mb-1 flex justify-between font-mono text-xs text-muted">
                <span>{formatBytes(status.usage)} used</span>
                <span>{formatBytes(status.quota)} available</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="meter" aria-label="Storage used" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full bg-accent-fill" style={{ width: `${Math.max(pct, 0.5)}%` }} />
              </div>
            </div>
            <div className="flex items-start gap-3">
              {status.persisted ? (
                <ShieldCheck size={18} className="mt-0.5 shrink-0 text-success" aria-hidden />
              ) : (
                <ShieldAlert size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden />
              )}
              <div className="flex-1">
                <p className="font-medium">{status.persisted ? 'Protected storage is on' : 'Protected storage is off'}</p>
                <p className="text-muted">
                  {status.persisted
                    ? 'The browser has agreed not to clear NoteDoco’s data when space runs low.'
                    : 'The browser may clear NoteDoco’s data if the device runs low on space. Installing the app makes browsers more likely to agree.'}
                </p>
              </div>
              {!status.persisted && (
                <Button size="sm" onPress={async () => { await requestPersistence(); refresh(); }}>
                  Ask browser
                </Button>
              )}
            </div>
          </>
        ) : (
          <p className="text-muted">This browser doesn’t report storage details.</p>
        )}
        <p className="text-muted">Backup, restore and export arrive in Phase 1.</p>
      </div>
    </Section>
  );
}

export function SettingsPage() {
  const theme = useTheme((s) => s.theme);
  return (
    <Pane title="Settings">
      <Section title="Appearance">
        <RadioGroup value={theme} onChange={(v) => setTheme(v as Theme)} aria-label="Theme" className="flex flex-wrap gap-2">
          {THEMES.map((t) => (
            <Radio
              key={t.value}
              value={t.value}
              className="cursor-pointer rounded-panel border border-border px-3 py-2 text-sm outline-none data-[focus-visible]:ring-2 data-[focus-visible]:ring-focus data-[selected]:border-accent data-[selected]:bg-accent-soft data-[selected]:font-medium"
            >
              {t.label}
            </Radio>
          ))}
        </RadioGroup>
      </Section>
      <StorageSection />
      <Section title="About">
        <div className="space-y-2 text-sm">
          <p>
            NoteDoco <span className="font-mono">{__APP_VERSION__}</span>. This is an early preview of v2; your v1 notes are
            untouched and still available in the{' '}
            <a className="text-accent underline" href="../">
              current app
            </a>
            .
          </p>
          <a className="inline-flex items-center gap-1 text-accent underline" href="https://timedoco.com/app/" target="_blank" rel="noreferrer">
            TimeDoco, the time-tracking sibling <ExternalLink size={13} aria-hidden />
          </a>
        </div>
      </Section>
    </Pane>
  );
}

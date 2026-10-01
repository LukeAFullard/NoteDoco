import { useEffect, useState, type ReactNode } from 'react';
import { Radio, RadioGroup } from 'react-aria-components';
import { ExternalLink, ShieldCheck, ShieldAlert } from 'lucide-react';
import { Pane } from '@/app/Pane';
import { Button } from '@/design/Button';
import { setTheme, useTheme, type Theme } from '@/app/theme';
import { formatBytes, getStorageStatus, requestPersistence, type StorageStatus } from '@/app/durability';
import { useStorageHealth } from '@/data/health';
import { setPrefs, usePrefs, type Prefs } from '@/app/prefs';
import { Switch } from '@/design/Switch';
import { useUi } from '@/app/ui';
import { DataSection } from './DataSection';
import { RemindersSettings } from '@/features/reminders/RemindersSettings';

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

function Choice<K extends keyof Prefs>({ label, prefKey, options }: { label: string; prefKey: K; options: Array<{ value: Prefs[K]; label: string }> }) {
  const value = usePrefs((p) => p[prefKey]);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="w-28 shrink-0 text-sm">{label}</span>
      <RadioGroup value={String(value)} onChange={(v) => setPrefs({ [prefKey]: options.find((o) => String(o.value) === v)!.value } as Partial<Prefs>)} aria-label={label} orientation="horizontal" className="flex flex-wrap gap-2">
        {options.map((o) => (
          <Radio
            key={String(o.value)}
            value={String(o.value)}
            className="cursor-pointer rounded-panel border border-border px-3 py-1.5 text-sm outline-none data-[focus-visible]:ring-2 data-[focus-visible]:ring-focus data-[selected]:border-accent data-[selected]:bg-accent-soft data-[selected]:font-medium"
          >
            {o.label}
          </Radio>
        ))}
      </RadioGroup>
    </div>
  );
}

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
      </div>
    </Section>
  );
}

export function SettingsPage() {
  const theme = useTheme((s) => s.theme);
  const tidy = usePrefs((p) => p.tidyStickies);
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
        <div className="mt-4 space-y-3">
          <Choice label="Text size" prefKey="textSize" options={[{ value: 'small', label: 'Small' }, { value: 'medium', label: 'Medium' }, { value: 'large', label: 'Large' }]} />
          <Choice label="Spacing" prefKey="density" options={[{ value: 'comfortable', label: 'Comfortable' }, { value: 'compact', label: 'Compact' }]} />
          <Choice label="Sticky font" prefKey="stickyFont" options={[{ value: 'sans', label: 'Clean' }, { value: 'hand', label: 'Handwritten' }, { value: 'serif', label: 'Serif' }]} />
          <Switch isSelected={!tidy} onChange={(v) => setPrefs({ tidyStickies: !v })}>
            Stickies sit at a slight angle, like paper
          </Switch>
        </div>
      </Section>
      <Section title="Dates & reminders">
        <div className="space-y-4">
          <Choice label="Week starts on" prefKey="weekStart" options={[{ value: 'auto', label: 'Automatic' }, { value: 'monday', label: 'Monday' }, { value: 'sunday', label: 'Sunday' }]} />
          <RemindersSettings />
        </div>
      </Section>
      <Section title="Backup & import">
        <DataSection />
      </Section>
      <StorageSection />
      <Section title="Keyboard">
        <button type="button" className="text-sm text-accent underline" onClick={() => useUi.setState({ shortcutsOpen: true })}>
          Show keyboard shortcuts (press ? anywhere)
        </button>
      </Section>
      <Section title="About">
        <div className="space-y-2 text-sm">
          <p>
            NoteDoco <span className="font-mono">{__APP_VERSION__}</span>. Notes from the previous version were brought over automatically
            (see Backup &amp; import); the originals were never changed.
          </p>
          <a className="inline-flex items-center gap-1 text-accent underline" href="https://timedoco.com/app/" target="_blank" rel="noreferrer">
            TimeDoco, the time-tracking sibling <ExternalLink size={13} aria-hidden />
          </a>
        </div>
      </Section>
    </Pane>
  );
}

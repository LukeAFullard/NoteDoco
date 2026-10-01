import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Eraser, Highlighter, Maximize, PenLine, PenTool, Pencil, Redo2, SlidersHorizontal, Trash2, Undo2, Activity, ClipboardCopy } from 'lucide-react';
import { Pane } from '@/app/Pane';
import { IconButton, Button } from '@/design/Button';
import { Switch } from '@/design/Switch';
import { Dialog } from '@/design/Dialog';
import { showToast } from '@/design/toast';
import { cn } from '@/design/cn';
import { readPref, writePref } from '@/lib/localPref';
import { useTheme } from '@/app/theme';
import { DEFAULT_LAB_SETTINGS, InkLabEngine, type EngineState, type LabSettings, type LabTool } from './engine';

type Paper = 'blank' | 'lined' | 'grid' | 'dot';

const TOOLS: Array<{ tool: LabTool; label: string; icon: ReactNode }> = [
  { tool: 'ballpoint', label: 'Ballpoint', icon: <Pencil size={18} /> },
  { tool: 'fountain', label: 'Fountain pen', icon: <PenTool size={18} /> },
  { tool: 'marker', label: 'Marker', icon: <PenLine size={18} /> },
  { tool: 'highlighter', label: 'Highlighter', icon: <Highlighter size={18} /> },
  { tool: 'eraser', label: 'Eraser', icon: <Eraser size={18} /> },
];

const INKS = [
  { name: 'Ink', light: '#1c1f22', dark: '#eef0ec' },
  { name: 'Blue', light: '#2456c8', dark: '#8fb4ff' },
  { name: 'Red', light: '#c8372d', dark: '#ff8a80' },
  { name: 'Green', light: '#2e7d4f', dark: '#7fd4a0' },
  { name: 'Amber', light: '#b7791f', dark: '#f2c14e' },
];

const SIZES = [
  { scale: 0.7, label: 'Fine' },
  { scale: 1, label: 'Medium' },
  { scale: 1.6, label: 'Bold' },
];

/** Paper as CSS background layers; the engine scales and offsets them with the camera. */
function paperBackground(paper: Paper, dark: boolean): { image: string; colour: string } {
  const line = dark ? 'rgba(238,240,236,0.10)' : 'rgba(38,49,58,0.13)';
  const dot = dark ? 'rgba(238,240,236,0.30)' : 'rgba(38,49,58,0.35)';
  const colour = dark ? '#1a2229' : '#fbfaf6';
  switch (paper) {
    case 'lined':
      return { colour, image: `linear-gradient(to bottom, transparent calc(100% - 1px), ${line} calc(100% - 1px))` };
    case 'grid':
      return {
        colour,
        image: `linear-gradient(to right, ${line} 1px, transparent 1px), linear-gradient(to bottom, ${line} 1px, transparent 1px)`,
      };
    case 'dot':
      return { colour, image: `radial-gradient(circle at 1px 1px, ${dot} 1.2px, transparent 1.4px)` };
    default:
      return { colour, image: 'none' };
  }
}

function buildReport(engine: InkLabEngine, settings: LabSettings) {
  const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return {
    kind: 'notedoco-ink-lab-report',
    version: 1,
    at: new Date().toISOString(),
    userAgent: navigator.userAgent,
    installed: standalone,
    devicePixelRatio: devicePixelRatio,
    screen: `${screen.width}x${screen.height}`,
    maxTouchPoints: navigator.maxTouchPoints,
    support: engine.support(),
    settings,
    router: { ...engine.router.stats, penSeen: engine.router.penSeen },
    measured: engine.metrics.summary(),
  };
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

/**
 * Ink lab (spike P0.7): a pen prototype for measuring latency, sample rate and palm rejection
 * on real devices before committing to the custom ink engine. Not persisted.
 */
export function InkLab() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [engine, setEngine] = useState<InkLabEngine | null>(null);
  const theme = useTheme((s) => s.theme);
  const dark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const [settings, setSettings] = useState<LabSettings>(() => ({ ...DEFAULT_LAB_SETTINGS, ...readPref('inkLab:settings', {}) }));
  const [paper, setPaper] = useState<Paper>(() => readPref('inkLab:paper', 'lined'));
  const [state, setState] = useState<EngineState | null>(null);
  const [inkIndex, setInkIndex] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showStats, setShowStats] = useState(() => readPref('inkLab:stats', true));
  const [statsTick, setStatsTick] = useState(0);
  const [reportText, setReportText] = useState<string | null>(null);

  // The engine lives as long as the page; settings, colour and paper changes are pushed below.
  const initialSettings = useRef(settings);
  useEffect(() => {
    const created = new InkLabEngine(hostRef.current!, initialSettings.current, setState);
    setEngine(created);
    return () => created.destroy();
  }, []);

  useEffect(() => {
    engine?.setPaper(paperBackground(paper, dark));
  }, [engine, paper, dark, theme]);

  useEffect(() => {
    engine?.updateSettings(settings);
    writePref('inkLab:settings', settings);
  }, [engine, settings]);

  const tool = state?.tool;
  useEffect(() => {
    const ink = INKS[inkIndex]!;
    // The plain "Ink" colour makes a grey smear as a highlighter, so highlight in amber instead.
    const chosen = tool === 'highlighter' && inkIndex === 0 ? INKS[4]! : ink;
    engine?.setColour(dark ? chosen.dark : chosen.light);
  }, [engine, inkIndex, dark, theme, tool]);

  useEffect(() => {
    if (!showStats) return;
    const id = setInterval(() => setStatsTick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, [showStats]);

  const summary = engine?.metrics.summary();
  const support = engine?.support();
  void statsTick;

  const set = (patch: Partial<LabSettings>) => setSettings((s) => ({ ...s, ...patch }));

  const copyReport = async () => {
    if (!engine) return;
    const text = JSON.stringify(buildReport(engine, settings), null, 2);
    try {
      await navigator.clipboard.writeText(text);
      showToast({ message: 'Report copied. Paste it into your chat with Claude.' }, 4000);
    } catch {
      setReportText(text); // clipboard blocked: show it for manual copying
    }
  };

  return (
    <Pane
      title="Ink lab"
      actions={
        <div className="flex items-center gap-1">
          <IconButton label="Undo" isDisabled={!state?.canUndo} onPress={() => engine?.undo()}>
            <Undo2 size={18} />
          </IconButton>
          <IconButton label="Redo" isDisabled={!state?.canRedo} onPress={() => engine?.redo()}>
            <Redo2 size={18} />
          </IconButton>
          <IconButton label="Reset zoom" onPress={() => engine?.resetView()}>
            <Maximize size={18} />
          </IconButton>
          <IconButton label="Pen settings" onPress={() => setShowSettings(true)}>
            <SlidersHorizontal size={18} />
          </IconButton>
          <IconButton
            label={showStats ? 'Hide measurements' : 'Show measurements'}
            onPress={() => {
              writePref('inkLab:stats', !showStats);
              setShowStats(!showStats);
            }}
          >
            <Activity size={18} />
          </IconButton>
        </div>
      }
    >
      <div className="flex h-full flex-col">
        <div role="toolbar" aria-label="Pen tools" className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
          <div className="flex gap-1">
            {TOOLS.map((t) => (
              <IconButton
                key={t.tool}
                label={t.label}
                aria-pressed={state?.tool === t.tool}
                onPress={() => engine?.setTool(t.tool)}
                className={cn(state?.tool === t.tool && '!bg-accent-soft !text-accent')}
              >
                {t.icon}
              </IconButton>
            ))}
          </div>
          <div className="mx-1 h-6 w-px bg-border" />
          <div className="flex gap-1.5" role="radiogroup" aria-label="Ink colour">
            {INKS.map((ink, i) => (
              <button
                key={ink.name}
                type="button"
                role="radio"
                aria-checked={inkIndex === i}
                aria-label={ink.name}
                onClick={() => setInkIndex(i)}
                className={cn('h-8 w-8 rounded-full border-2', inkIndex === i ? 'border-accent' : 'border-transparent')}
              >
                <span className="m-auto block h-5 w-5 rounded-full" style={{ background: dark ? ink.dark : ink.light }} />
              </button>
            ))}
          </div>
          <div className="mx-1 h-6 w-px bg-border" />
          <div className="flex gap-1" role="radiogroup" aria-label="Pen size">
            {SIZES.map((s) => (
              <button
                key={s.label}
                type="button"
                role="radio"
                aria-checked={state?.scale === s.scale}
                aria-label={s.label}
                onClick={() => engine?.setScale(s.scale)}
                className={cn('flex h-8 w-8 items-center justify-center rounded-panel', state?.scale === s.scale ? 'bg-accent-soft' : 'hover:bg-surface-2')}
              >
                <span className="block rounded-full bg-text" style={{ width: 4 * s.scale + 2, height: 4 * s.scale + 2 }} />
              </button>
            ))}
          </div>
          <div className="mx-1 h-6 w-px bg-border" />
          <select
            aria-label="Paper"
            value={paper}
            onChange={(e) => {
              setPaper(e.target.value as Paper);
              writePref('inkLab:paper', e.target.value);
            }}
            className="h-8 rounded-panel border border-border bg-surface px-2 text-sm"
          >
            <option value="lined">Lined</option>
            <option value="grid">Grid</option>
            <option value="dot">Dots</option>
            <option value="blank">Blank</option>
          </select>
          <Button size="sm" variant="danger" onPress={() => engine?.clear()} isDisabled={!state?.strokeCount}>
            <Trash2 size={15} aria-hidden /> Clear
          </Button>
        </div>

        <div className="relative min-h-0 flex-1">
          <div
            ref={hostRef}
            data-testid="ink-surface"
            aria-label="Drawing surface"
            role="img"
            className="absolute inset-0 overflow-hidden select-none"
            style={{ touchAction: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' } as React.CSSProperties}
          />
          {state && state.strokeCount === 0 && (
            <div className="pointer-events-none absolute inset-x-0 top-6 mx-auto max-w-md px-6 text-center text-sm text-muted">
              Write with your pen. Fingers pan and pinch to zoom; tap with two fingers to undo, three to redo.
              When you’re done, open the measurements and tap <strong>Copy report</strong>.
            </div>
          )}
          {showStats && summary && support && (
            <div className="absolute right-3 bottom-3 w-72 rounded-panel border border-border bg-surface/95 p-3 font-mono text-[11px] shadow-lg backdrop-blur">
              <div className="mb-2 flex items-center justify-between font-sans text-xs font-semibold">
                Measurements
                <button type="button" className="text-muted hover:text-text" onClick={() => engine?.metrics.reset()}>
                  Reset
                </button>
              </div>
              <Stat label="Pen samples / s" value={summary.penSampleRateHz ?? '–'} />
              <Stat label="Move events / s" value={summary.moveEventsPerSec ?? '–'} />
              <Stat label="Event→frame p50/p95" value={`${summary.eventToFrameMs.p50 ?? '–'} / ${summary.eventToFrameMs.p95 ?? '–'} ms`} />
              <Stat label="Paint cost p95" value={`${summary.wetPaintMs.p95 ?? '–'} ms`} />
              <Stat label="Pressure range" value={summary.pressure ? `${summary.pressure.min}–${summary.pressure.max}` : '–'} />
              <Stat label="Tilt / hover" value={`${summary.tiltSeen ? 'yes' : 'no'} / ${summary.hoverSeen ? 'yes' : 'no'}`} />
              <Stat label="Palms rejected" value={engine!.router.stats.palmsRejected + engine!.router.stats.retracted} />
              <Stat label="Strokes / bytes per pt" value={`${summary.strokes} / ${summary.bytesPerPoint ?? '–'}`} />
              <Stat label="Pointers" value={Object.entries(summary.pointerTypes).map(([k, v]) => `${k}:${v}`).join(' ') || '–'} />
              <div className="mt-2 border-t border-border pt-2">
                <Stat label="Full-rate samples" value={support.coalescedEvents ? 'yes' : 'no'} />
                <Stat label="Prediction" value={support.predictedEvents ? 'yes' : 'no'} />
                <Stat label="Low-latency canvas" value={support.lowLatencyCanvasGranted === null ? 'off' : support.lowLatencyCanvasGranted ? 'granted' : 'refused'} />
              </div>
              <Button size="sm" variant="primary" className="mt-3 w-full font-sans" onPress={copyReport}>
                <ClipboardCopy size={14} aria-hidden /> Copy report
              </Button>
            </div>
          )}
        </div>
      </div>

      <Dialog isOpen={showSettings} onOpenChange={setShowSettings} title="Pen settings">
        <div className="flex flex-col gap-4 p-5 text-sm">
          <Switch isSelected={settings.fingerDraws} onChange={(v) => set({ fingerDraws: v })}>
            Draw with finger (until a pen is used)
          </Switch>
          <Switch isSelected={settings.pressure} onChange={(v) => set({ pressure: v })}>
            Pressure changes line width
          </Switch>
          <p className="-mb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted">Experiments</p>
          <Switch isSelected={settings.coalesced} onChange={(v) => set({ coalesced: v })}>
            Full-rate pen samples
          </Switch>
          <Switch isSelected={settings.prediction} onChange={(v) => set({ prediction: v })}>
            Predict ahead of the pen
          </Switch>
          <Switch isSelected={settings.lowLatencyCanvas} onChange={(v) => set({ lowLatencyCanvas: v })}>
            Low-latency canvas
          </Switch>
          <Switch isSelected={settings.osInkTrail} onChange={(v) => set({ osInkTrail: v })}>
            System ink trail (Chrome/Edge only)
          </Switch>
          <Switch isSelected={settings.rawUpdates} onChange={(v) => set({ rawUpdates: v })}>
            Raw pointer updates (Chrome/Edge only)
          </Switch>
          <label className="flex items-center gap-3">
            <span className="flex-1">Palm size threshold</span>
            <input
              type="range"
              min={20}
              max={120}
              value={settings.palmSize}
              onChange={(e) => set({ palmSize: Number(e.target.value) })}
              aria-valuetext={`${settings.palmSize} pixels`}
            />
            <span className="w-12 text-right font-mono tabular-nums">{settings.palmSize}px</span>
          </label>
          <div className="flex justify-end">
            <Button variant="primary" onPress={() => setShowSettings(false)}>
              Done
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog isOpen={reportText !== null} onOpenChange={(o) => !o && setReportText(null)} title="Ink lab report">
        <div className="p-5">
          <p className="mb-2 text-sm text-muted">Copying was blocked. Select all of this and copy it by hand:</p>
          <textarea readOnly value={reportText ?? ''} className="h-64 w-full rounded-panel border border-border bg-bg p-2 font-mono text-xs" />
        </div>
      </Dialog>
    </Pane>
  );
}

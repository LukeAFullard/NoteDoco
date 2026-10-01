import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Maximize, Minus, Plus } from 'lucide-react';
import { InkEngine, type EngineState, type InkTool } from '@/canvas/engine';
import { fromStored, toStored, type StrokeChange } from '@/canvas/model';
import { HIGHLIGHTER_COLOUR_KEYS } from '@/canvas/inkColours';
import { addPage, listPages, loadInk, saveStrokes } from '@/data/repos/ink';
import { updateItem } from '@/data/repos/items';
import type { InkPage, Item } from '@/data/types';
import { IconButton } from '@/design/Button';
import { EmptyState } from '@/design/EmptyState';
import { showToast } from '@/design/toast';
import { isTypingTarget } from '@/app/shortcuts';
import { useDebouncedSave } from '@/lib/useDebouncedSave';
import { readPref, writePref } from '@/lib/localPref';
import { InkToolbar } from './InkToolbar';
import { TOOLS } from './tools';

interface PenPrefs {
  tool: InkTool;
  /** Last colour per kind of tool: pens share one, the highlighter has its own. */
  pen: string;
  highlighter: string;
  size: number;
}

const DEFAULT_PREFS: PenPrefs = { tool: 'ballpoint', pen: 'black', highlighter: 'yellow', size: 1 };
const PREF_KEY = 'ink.pen';

const PAN_STEP = 64;

/**
 * Saves strokes in order, one action at a time. If storage fails, says so (decision 0003):
 * nothing is kept only in memory without the user knowing.
 */
function useStrokeSaver(itemId: string) {
  const queue = useRef<Promise<void>>(Promise.resolve());
  return useCallback(
    (c: StrokeChange) => {
      queue.current = queue.current
        .then(() => saveStrokes(itemId, c.added.map(toStored), c.removed.map((s) => s.id)))
        .catch((err: unknown) => {
          console.error(err);
          showToast({ message: 'Your latest ink couldn’t be saved. Check that storage isn’t full, then keep writing.', tone: 'danger' }, 0);
        });
    },
    [itemId],
  );
}

function TitleField({ item }: { item: Item }) {
  const [title, setTitle] = useState(item.title);
  const { schedule } = useDebouncedSave((t: string) => updateItem(item.id, { title: t.trim() }));
  return (
    <input
      value={title}
      onChange={(e) => {
        setTitle(e.target.value);
        schedule(e.target.value);
      }}
      placeholder="Untitled"
      aria-label="Title"
      className="w-full min-w-0 bg-transparent px-3 py-2 text-xl font-semibold outline-none placeholder:text-muted"
    />
  );
}

/** A handwritten note (P3.5): pages of ink, saved as you write. */
export function InkEditor({ item }: { item: Item }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<InkEngine | null>(null);
  const [pages, setPages] = useState<InkPage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<EngineState | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const save = useStrokeSaver(item.id);
  const itemId = item.id;
  const appendPageRef = useRef<() => void>(() => {});

  // Load once per note, then hand everything to the engine.
  useEffect(() => {
    let live = true;
    let engine: InkEngine | null = null;
    loadInk(itemId)
      .then(({ pages: loadedPages, strokes }) => {
        if (!live) return;
        setPages(loadedPages);
        const host = hostRef.current;
        if (!host) return;
        const prefs = { ...DEFAULT_PREFS, ...readPref<Partial<PenPrefs>>(PREF_KEY, {}) };
        engine = new InkEngine(host, {
          pages: loadedPages,
          strokes: strokes.map(fromStored),
          onState: setState,
          onChange: save,
          onNearEnd: () => void appendPage(true),
        });
        engine.tool = prefs.tool;
        engine.colour = prefs.tool === 'highlighter' ? prefs.highlighter : prefs.pen;
        engine.size = prefs.size;
        engineRef.current = engine;
        setState(engine.state);
      })
      .catch((err: unknown) => {
        if (live) setError(err instanceof Error ? err.message : String(err));
      });

    let adding = false;
    const appendPage = async (automatic: boolean) => {
      if (adding) return;
      adding = true;
      const page = await addPage(itemId).finally(() => (adding = false));
      const next = await listPages(page.docId);
      if (!live) return;
      setPages(next);
      engine?.setPages(next);
      if (!automatic) engine?.scrollToPage(next.findIndex((p) => p.id === page.id));
      setAnnouncement(automatic ? 'A new page was added below.' : `Page ${next.length} added.`);
    };
    appendPageRef.current = () => void appendPage(false);

    return () => {
      live = false;
      engine?.destroy();
      engineRef.current = null;
    };
  }, [itemId, save]);

  const remember = (patch: Partial<PenPrefs>) => writePref(PREF_KEY, { ...DEFAULT_PREFS, ...readPref<Partial<PenPrefs>>(PREF_KEY, {}), ...patch });

  const setTool = (tool: InkTool) => {
    const engine = engineRef.current;
    if (!engine) return;
    const prefs = { ...DEFAULT_PREFS, ...readPref<Partial<PenPrefs>>(PREF_KEY, {}) };
    // Switching between pens and the highlighter brings back that tool's last colour.
    const wasHighlighter = (HIGHLIGHTER_COLOUR_KEYS as readonly string[]).includes(engine.colour);
    if (tool === 'highlighter' && !wasHighlighter) engine.setColour(prefs.highlighter);
    if (tool !== 'highlighter' && tool !== 'eraser' && wasHighlighter) engine.setColour(prefs.pen);
    engine.setTool(tool);
    remember({ tool });
  };

  const setColour = (colour: string) => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setColour(colour);
    const isHighlighter = engine.tool === 'highlighter' || (HIGHLIGHTER_COLOUR_KEYS as readonly string[]).includes(colour);
    remember(isHighlighter ? { highlighter: colour } : { pen: colour });
  };

  const setSize = (size: number) => {
    engineRef.current?.setSize(size);
    remember({ size });
  };

  const undo = () => {
    if (engineRef.current?.undo()) setAnnouncement('Undone.');
  };
  const redo = () => {
    if (engineRef.current?.redo()) setAnnouncement('Redone.');
  };

  /** Keys while the canvas or toolbar has focus. Handled here so app-wide undo doesn't also run. */
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const engine = engineRef.current;
    if (!engine || isTypingTarget(e.target)) return;
    const mod = e.metaKey || e.ctrlKey;
    const k = e.key.toLowerCase();
    const handled = () => {
      e.preventDefault();
      e.stopPropagation();
    };
    if (mod && k === 'z') return void (handled(), e.shiftKey ? redo() : undo());
    if (mod && k === 'y') return void (handled(), redo());
    if (mod || e.altKey) return;
    const onCanvas = e.target === hostRef.current;
    if (onCanvas) {
      const pan: Record<string, [number, number]> = {
        ArrowUp: [0, PAN_STEP],
        ArrowDown: [0, -PAN_STEP],
        ArrowLeft: [PAN_STEP, 0],
        ArrowRight: [-PAN_STEP, 0],
        PageUp: [0, hostRef.current!.clientHeight * 0.9],
        PageDown: [0, -hostRef.current!.clientHeight * 0.9],
      };
      const d = pan[e.key];
      if (d) return void (handled(), engine.panBy(d[0], d[1]));
    }
    if (e.key === '+' || e.key === '=') return void (handled(), engine.zoomBy(1.25));
    if (e.key === '-') return void (handled(), engine.zoomBy(0.8));
    if (e.key === '0') return void (handled(), engine.fit());
    const tool = TOOLS.find((t) => t.key.toLowerCase() === k);
    if (tool) return void (handled(), setTool(tool.tool));
  };

  if (error) {
    return <EmptyState title="This ink note couldn’t be opened" body={`Something went wrong reading it from storage (${error}). Try reloading the page.`} />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col" onKeyDown={onKeyDown}>
      <TitleField item={item} />
      {state && (
        <InkToolbar
          state={state}
          onTool={setTool}
          onColour={setColour}
          onSize={setSize}
          onUndo={undo}
          onRedo={redo}
          onAddPage={() => appendPageRef.current()}
        />
      )}
      <div className="relative min-h-0 flex-1">
        <div
          ref={hostRef}
          tabIndex={0}
          role="application"
          aria-roledescription="drawing canvas"
          aria-label="Ink pages. Write with a pen, mouse or finger; two fingers move and zoom. Arrow keys scroll, plus and minus zoom, P F M H E pick a tool."
          data-testid="ink-canvas"
          className="absolute inset-0 touch-none overflow-hidden bg-desk outline-none select-none [-webkit-touch-callout:none] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
        />
        {!pages && <p className="absolute inset-x-0 top-8 text-center text-sm text-muted">Opening…</p>}
        {state && (
          <div className="absolute right-2 bottom-2 flex items-center gap-0.5 rounded-panel border border-border bg-surface/95 p-0.5 text-sm shadow">
            <span className="px-2 text-muted">
              Page {state.page + 1} of {state.pageCount}
            </span>
            <IconButton label="Zoom out" size="sm" onPress={() => engineRef.current?.zoomBy(0.8)}>
              <Minus size={16} />
            </IconButton>
            <span className="w-12 text-center tabular-nums" aria-label={`Zoom ${Math.round(state.zoom * 100)} percent`}>
              {Math.round(state.zoom * 100)}%
            </span>
            <IconButton label="Zoom in" size="sm" onPress={() => engineRef.current?.zoomBy(1.25)}>
              <Plus size={16} />
            </IconButton>
            <IconButton label="Fit page width" size="sm" onPress={() => engineRef.current?.fit()}>
              <Maximize size={16} />
            </IconButton>
          </div>
        )}
        <span className="sr-only" role="status">
          {announcement}
        </span>
      </div>
    </div>
  );
}

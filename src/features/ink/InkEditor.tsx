import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ClipboardEvent, type DragEvent, type KeyboardEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Maximize, Minus, Plus } from 'lucide-react';
import { InkEngine, type EngineState, type EraserMode, type InkTool } from '@/canvas/engine';
import { fromStored, toStored, type StrokeChange } from '@/canvas/model';
import { HIGHLIGHTER_COLOUR_KEYS } from '@/canvas/inkColours';
import { addAttachment } from '@/data/repos/attachments';
import { newId, nowIso } from '@/lib/ids';
import { db } from '@/data/db';
import { addPage, listPages, loadInk, saveStrokes } from '@/data/repos/ink';
import { updateItem } from '@/data/repos/items';
import type { InkElement, Item } from '@/data/types';
import { IconButton } from '@/design/Button';
import { EmptyState } from '@/design/EmptyState';
import { showToast } from '@/design/toast';
import { isTypingTarget } from '@/app/shortcuts';
import { useDebouncedSave } from '@/lib/useDebouncedSave';
import { readPref, useLocalPref, writePref } from '@/lib/localPref';
import { InkToolbar } from './InkToolbar';
import { SelectionBar } from './SelectionBar';
import { PageSorter } from './PageSorter';
import { PaperDialog } from './PaperDialog';
import { TOOLS } from './tools';
import { ElementsLayer, type DraftText } from './ElementsLayer';
import { addFavourite, DEFAULT_FAVOURITES, removeFavourite, type Favourite } from './favourites';
import { engineSettings, usePenSettings } from './penSettings';
import { PenSettingsPanel } from './PenSettingsPanel';
import { Dialog } from '@/design/Dialog';
import { cn } from '@/design/cn';

interface PenPrefs {
  tool: InkTool;
  /** Last colour per kind of tool: pens share one, the highlighter has its own. */
  pen: string;
  highlighter: string;
  size: number;
  eraser: EraserMode;
  eraseHighlighterOnly: boolean;
}

const DEFAULT_PREFS: PenPrefs = { tool: 'ballpoint', pen: 'black', highlighter: 'yellow', size: 1, eraser: 'stroke', eraseHighlighterOnly: false };
const PREF_KEY = 'ink.pen';
const prefs = (): PenPrefs => ({ ...DEFAULT_PREFS, ...readPref<Partial<PenPrefs>>(PREF_KEY, {}) });
const remember = (patch: Partial<PenPrefs>) => writePref(PREF_KEY, { ...prefs(), ...patch });

const PAN_STEP = 64;
/** New text boxes: width and type size in page pixels. */
const TEXT_WIDTH = 320;
const TEXT_SIZE = 18;

/** An image's natural size, for placing it (falls back to 4:3 if it can't be read). */
async function imageSize(file: Blob): Promise<{ w: number; h: number }> {
  try {
    const bmp = await createImageBitmap(file);
    const size = { w: bmp.width, h: bmp.height };
    bmp.close();
    return size;
  } catch {
    return { w: 400, h: 300 };
  }
}
const isHighlighterColour = (c: string) => (HIGHLIGHTER_COLOUR_KEYS as readonly string[]).includes(c);

/**
 * Saves strokes in order, one action at a time. If storage fails, says so (decision 0003):
 * nothing is kept only in memory without the user knowing.
 */
function useStrokeSaver(itemId: string, onSaved: () => void) {
  const queue = useRef<Promise<void>>(Promise.resolve());
  const saved = useRef(onSaved);
  useLayoutEffect(() => {
    saved.current = onSaved;
  });
  return useCallback(
    (c: StrokeChange) => {
      queue.current = queue.current
        .then(() => saveStrokes(itemId, c.added.map(toStored), c.removed.map((s) => s.id), c.addedEls, c.removedEls?.map((e) => e.id)))
        .catch((err: unknown) => {
          console.error(err);
          showToast({ message: 'Your latest ink couldn’t be saved. Check that storage isn’t full, then keep writing.', tone: 'danger' }, 0);
        });
      void queue.current.then(() => saved.current());
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

/** A handwritten note (P3.5): its title and pages of ink, saved as you write. */
export function InkEditor({ item }: { item: Item }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <TitleField item={item} />
      <InkSurface itemId={item.id} />
    </div>
  );
}

/**
 * The ink editor itself: toolbar, pages and dialogs. Opens an ink note's pages, or with
 * `docId` and `block` a sketch inside a typed note (NOTE-8).
 */
export function InkSurface({ itemId, docId: sketchId, block = false }: { itemId: string; docId?: string; block?: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [engine, setEngine] = useState<InkEngine | null>(null);
  const [docId, setDocId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<EngineState | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [dialog, setDialog] = useState<'pages' | 'paper' | 'pen' | null>(null);
  const pen = usePenSettings();
  const [editing, setEditingState] = useState<DraftText | null>(null);
  const editingAt = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const [favourites, setFavourites] = useLocalPref<Favourite[]>('ink.favourites', DEFAULT_FAVOURITES);
  const known = useRef(new Set<string>());
  const scrollTo = useRef<string | null>(null);
  const adding = useRef(false);
  // Ink notes get a fresh thumbnail for cards and the timeline a little after writing stops.
  const thumb = useDebouncedSave(() => (block ? undefined : import('./thumbnail').then((m) => m.updateThumbnail(itemId))), 2500);
  const scheduleThumb = thumb.schedule; // stable
  const save = useStrokeSaver(itemId, () => scheduleThumb(undefined));
  const say = (msg: string) => setAnnouncement(msg);
  // Tapping away from a text box being edited only finishes it; it doesn't start another.
  const setEditing = useCallback((d: DraftText | null) => {
    editingAt.current = d ? 0 : performance.now();
    setEditingState(d);
  }, []);
  const engineRef = useRef<InkEngine | null>(null);
  useLayoutEffect(() => {
    engineRef.current = engine;
  });
  const placeText = useCallback(
    (pageId: string, x: number, y: number) => {
      if (performance.now() - editingAt.current < 300) return;
      const e = engineRef.current;
      const page = e?.pageBoxes.find((b) => b.id === pageId);
      if (!e || !page) return;
      const colour = isHighlighterColour(e.colour) ? 'black' : e.colour;
      const el: InkElement = {
        id: newId(),
        pageId,
        kind: 'text',
        x,
        y: Math.max(0, y - TEXT_SIZE * 0.7),
        w: Math.min(TEXT_WIDTH, page.w - x),
        h: TEXT_SIZE * 1.35,
        text: '',
        fontSize: TEXT_SIZE,
        colour,
        attachmentId: null,
        createdAt: nowIso(),
      };
      setEditing({ el, isNew: true });
    },
    [setEditing],
  );

  const appendPage = useCallback(
    async (automatic: boolean) => {
      if (adding.current) return;
      adding.current = true;
      try {
        const page = await addPage(itemId);
        if (!automatic) scrollTo.current = page.id;
        setAnnouncement(automatic ? 'A new page was added below.' : 'Page added.');
      } finally {
        adding.current = false;
      }
    },
    [itemId],
  );

  // Load once per note, then hand everything to the engine.
  useEffect(() => {
    let live = true;
    let created: InkEngine | null = null;
    loadInk(itemId, sketchId)
      .then(({ doc, pages, strokes, elements }) => {
        const host = hostRef.current;
        if (!live || !host) return;
        const p = prefs();
        const ps = usePenSettings.getState();
        created = new InkEngine(host, {
          settings: engineSettings(ps),
          pages,
          strokes: strokes.map(fromStored),
          elements,
          block,
          onState: setState,
          onPlaceText: placeText,
          onChange: save,
          onNearEnd: block ? undefined : () => void appendPage(true),
          onSnap: (kind) => setAnnouncement(`Snapped to ${kind === 'arrow' || kind === 'ellipse' ? 'an' : 'a'} ${kind}. Undo to keep it as drawn.`),
        });
        created.tool = p.tool;
        created.colour = p.tool === 'highlighter' ? p.highlighter : p.pen;
        created.size = p.size;
        created.setEraser(p.eraser, p.eraseHighlighterOnly);
        known.current = new Set(pages.map((pg) => pg.id));
        setDocId(doc.id);
        if (!block && (strokes.length || elements.length)) void db.items.get(itemId).then((it) => it && !it.thumbnailId && scheduleThumb(undefined));
        setEngine(created);
      })
      .catch((err: unknown) => {
        if (live) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      live = false;
      created?.destroy();
      setEngine(null);
    };
  }, [itemId, sketchId, block, save, appendPage, placeText, scheduleThumb]);

  // Pen settings apply straight away, in every open ink editor.
  useEffect(() => {
    if (!engine) return;
    engine.updateSettings(engineSettings(pen));
  }, [engine, pen]);

  // Pages come from storage, so undo from a toast, the page sorter and other panes all show up.
  const pages = useLiveQuery(() => (docId ? listPages(docId) : undefined), [docId]);
  useEffect(() => {
    if (!engine || !pages) return;
    let live = true;
    const fresh = pages.filter((p) => !known.current.has(p.id)).map((p) => p.id);
    const load = fresh.length
      ? Promise.all([db.strokes.where('pageId').anyOf(fresh).toArray(), db.inkElements.where('pageId').anyOf(fresh).toArray()])
      : Promise.resolve([[], []] as const);
    void load.then(([strokes, elements]) => {
      if (!live) return;
      known.current = new Set(pages.map((p) => p.id));
      engine.setPages(pages, strokes.map(fromStored), [...elements]);
      const target = scrollTo.current;
      const i = target ? pages.findIndex((p) => p.id === target) : -1;
      if (i >= 0) {
        scrollTo.current = null;
        engine.scrollToPage(i);
      }
    });
    return () => {
      live = false;
    };
  }, [engine, pages]);

  /** Adds pictures to the page: where they were dropped, or in the middle of the view. */
  const insertImages = async (files: File[], at?: { clientX: number; clientY: number }) => {
    if (!engine) return;
    const images = files.filter((f) => f.type.startsWith('image/'));
    let offset = 0;
    for (const file of images) {
      const spot = at ? engine.pagePointAt(at.clientX, at.clientY) : engine.viewCentre();
      if (!spot) return;
      const natural = await imageSize(file);
      const w = Math.min(natural.w, spot.page.w * 0.6);
      const h = (natural.h * w) / natural.w;
      const att = await addAttachment(itemId, file);
      engine.addElement({
        id: newId(),
        pageId: spot.page.id,
        kind: 'image',
        x: Math.max(0, Math.min(spot.page.w - w, spot.x - (at ? 0 : w / 2) + offset)),
        y: Math.max(0, spot.y - (at ? 0 : h / 2) + offset),
        w,
        h,
        text: '',
        fontSize: TEXT_SIZE,
        colour: 'black',
        attachmentId: att.id,
        createdAt: nowIso(),
      });
      offset += 24;
    }
    if (images.length) say(images.length === 1 ? 'Image added.' : `${images.length} images added.`);
  };

  const onPaste = (e: ClipboardEvent<HTMLDivElement>) => {
    if (isTypingTarget(e.target)) return;
    const files = [...(e.clipboardData?.files ?? [])];
    if (!files.some((f) => f.type.startsWith('image/'))) return;
    e.preventDefault();
    void insertImages(files);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    const files = [...(e.dataTransfer?.files ?? [])];
    if (!files.length) return;
    e.preventDefault();
    void insertImages(files, { clientX: e.clientX, clientY: e.clientY });
  };

  const setTool = (tool: InkTool) => {
    if (!engine) return;
    const p = prefs();
    // Switching between pens and the highlighter brings back that tool's last colour.
    const wasHighlighter = isHighlighterColour(engine.colour);
    if (tool === 'highlighter' && !wasHighlighter) engine.setColour(p.highlighter);
    if (tool !== 'highlighter' && tool !== 'eraser' && tool !== 'lasso' && wasHighlighter) engine.setColour(p.pen);
    if (tool !== 'text' && editing) setEditing(null);
    engine.setTool(tool);
    remember({ tool });
  };

  const setColour = (colour: string) => {
    if (!engine) return;
    engine.setColour(colour);
    remember(engine.tool === 'highlighter' ? { highlighter: colour } : { pen: colour });
  };

  const setSize = (size: number) => {
    engine?.setSize(size);
    remember({ size });
  };

  const pickFavourite = (f: Favourite) => {
    if (!engine) return;
    engine.setTool(f.tool);
    engine.setColour(f.colour);
    engine.setSize(f.size);
    remember({ tool: f.tool, size: f.size, ...(f.tool === 'highlighter' ? { highlighter: f.colour } : { pen: f.colour }) });
  };

  const undo = () => engine?.undo() && say('Undone.');
  const redo = () => engine?.redo() && say('Redone.');

  /** Keys while the canvas or toolbar has focus. Handled here so app-wide shortcuts don't also run. */
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!engine || isTypingTarget(e.target) || dialog) return;
    const mod = e.metaKey || e.ctrlKey;
    const k = e.key.toLowerCase();
    const handled = () => {
      e.preventDefault();
      e.stopPropagation();
    };
    const sel = engine.state.selection;
    if (mod && k === 'z') return void (handled(), e.shiftKey ? redo() : undo());
    if (mod && k === 'y') return void (handled(), redo());
    if (mod && k === 'a') return void (handled(), engine.selectAll(), say('Everything on this page is selected.'));
    // Copied ink pastes here; anything else (an image) goes on to the paste event.
    if (mod && k === 'v' && engine.state.canPaste) return void (handled(), engine.paste() && say('Pasted.'));
    if (sel && mod && k === 'c') return void (handled(), engine.copySelection(), say('Copied.'));
    if (sel && mod && k === 'x') return void (handled(), engine.cutSelection(), say('Cut.'));
    if (sel && mod && k === 'd') return void (handled(), engine.duplicateSelection(), say('Duplicated.'));
    if (mod || e.altKey) return;
    if (sel && (e.key === 'Delete' || e.key === 'Backspace')) return void (handled(), engine.deleteSelection(), say('Deleted.'));
    if (sel && e.key === 'Escape') return void (handled(), engine.clearSelection());
    const arrows: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    const arrow = arrows[e.key];
    if (e.target === hostRef.current) {
      const step = e.shiftKey ? 10 : 1;
      if (arrow && sel) return void (handled(), engine.nudgeSelection(arrow[0] * step, arrow[1] * step));
      // Rotate and resize the selection by keyboard (the handles need a pointer).
      if (sel && (e.key === '[' || e.key === ']')) return void (handled(), engine.turnSelection(e.key === '[' ? -15 : 15), say(e.key === '[' ? 'Turned left.' : 'Turned right.'));
      if (sel && (e.key === ',' || e.key === '.')) return void (handled(), engine.scaleSelection(e.key === ',' ? 0.9 : 1.1), say(e.key === ',' ? 'Smaller.' : 'Bigger.'));
      if (arrow) return void (handled(), engine.panBy(-arrow[0] * PAN_STEP, -arrow[1] * PAN_STEP));
      const h = hostRef.current.clientHeight * 0.9;
      if (e.key === 'PageUp') return void (handled(), engine.panBy(0, h));
      if (e.key === 'PageDown') return void (handled(), engine.panBy(0, -h));
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
    <div
      className={cn(
        'flex h-full min-h-0 flex-1',
        // Toolbar position (INK-23). On narrow screens a side toolbar sits on top instead.
        pen.toolbar === 'bottom' ? 'flex-col-reverse' : 'flex-col',
        pen.toolbar === 'side' && (pen.hand === 'left' ? 'sm:flex-row-reverse' : 'sm:flex-row'),
      )}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      {engine && state && (
        <InkToolbar
          state={state}
          block={block}
          side={pen.toolbar === 'side'}
          bottom={pen.toolbar === 'bottom'}
          favourites={favourites}
          onTool={setTool}
          onColour={setColour}
          onSize={setSize}
          onEraser={(mode, only) => {
            engine.setEraser(mode, only);
            remember({ eraser: mode, eraseHighlighterOnly: only });
          }}
          onFavourite={pickFavourite}
          onAddFavourite={() => {
            if (state.tool === 'eraser' || state.tool === 'lasso' || state.tool === 'text') return;
            setFavourites(addFavourite(favourites, { tool: state.tool, colour: state.colour, size: state.size }));
            say('Added to favourites.');
          }}
          onRemoveFavourite={(i) => setFavourites(removeFavourite(favourites, i))}
          onUndo={undo}
          onRedo={redo}
          onAddPage={() => void appendPage(false)}
          onPages={() => setDialog('pages')}
          onPaper={() => setDialog('paper')}
          onPaste={() => engine.paste() && say('Pasted.')}
          onSelectAll={() => engine.selectAll()}
          onInsertImage={() => fileInput.current?.click()}
          onPenSettings={() => setDialog('pen')}
          onExport={(kind) => {
            say(kind === 'print' ? 'Preparing to print…' : 'Exporting…');
            void import('./exportInk').then((m) => m.exportInk(kind, itemId, { docId: sketchId, page: state.page }));
          }}
        />
      )}
      <div className="relative min-h-0 min-w-0 flex-1">
        <div
          ref={hostRef}
          tabIndex={0}
          role="application"
          aria-roledescription="drawing canvas"
          aria-label="Ink pages. Write with a pen, mouse or finger; two fingers move and zoom. Arrow keys scroll, plus and minus zoom, P F M H E L pick a tool."
          data-testid="ink-canvas"
          data-strokes={state?.strokeCount}
          className="absolute inset-0 touch-none overflow-hidden bg-desk outline-none select-none [-webkit-touch-callout:none] focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset"
        />
        {!engine && <p className="absolute inset-x-0 top-8 text-center text-sm text-muted">Opening…</p>}
        {engine && state?.selection && (
          <SelectionBar
            selection={state.selection}
            onColour={(colour) => engine.restyleSelection({ colour })}
            onSize={(size) => engine.restyleSelection({ size })}
            onDuplicate={() => engine.duplicateSelection()}
            onCopy={() => engine.copySelection() && say('Copied.')}
            onCut={() => engine.cutSelection()}
            onDelete={() => engine.deleteSelection()}
            onDone={() => engine.clearSelection()}
          />
        )}
        {engine && state && (
          // Away from the writing hand.
          <div
            className={cn(
              'absolute bottom-2 flex items-center gap-0.5 rounded-panel border border-border bg-surface/95 p-0.5 text-sm shadow',
              pen.hand === 'left' ? 'right-2' : 'left-2',
            )}
          >
            {!block && (
              <button
                type="button"
                className="rounded px-2 py-1.5 text-muted outline-none hover:text-text focus-visible:ring-2 focus-visible:ring-focus"
                onClick={() => setDialog('pages')}
              >
                Page {state.page + 1} of {state.pageCount}
              </button>
            )}
            <IconButton label="Zoom out" size="sm" onPress={() => engine.zoomBy(0.8)}>
              <Minus size={16} />
            </IconButton>
            <span className="w-12 text-center tabular-nums" aria-label={`Zoom ${Math.round(state.zoom * 100)} percent`}>
              {Math.round(state.zoom * 100)}%
            </span>
            <IconButton label="Zoom in" size="sm" onPress={() => engine.zoomBy(1.25)}>
              <Plus size={16} />
            </IconButton>
            <IconButton label="Fit page width" size="sm" onPress={() => engine.fit()}>
              <Maximize size={16} />
            </IconButton>
          </div>
        )}
        {engine && state && (
          <ElementsLayer
            engine={engine}
            tool={state.tool}
            zoom={state.zoom}
            version={`${state.elements}-${state.layout}`}
            editing={editing}
            setEditing={setEditing}
            onSay={say}
          />
        )}
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            const files = [...(e.target.files ?? [])]; // copy before resetting: the FileList is live
            e.target.value = '';
            void insertImages(files);
          }}
        />
        <span className="sr-only" role="status">
          {announcement}
        </span>
      </div>
      {engine && dialog === 'pages' && (
        <PageSorter
          itemId={itemId}
          engine={engine}
          layout={state?.layout ?? 0}
          onClose={() => setDialog(null)}
          onGoTo={(i) => {
            setDialog(null);
            engine.scrollToPage(i);
          }}
        />
      )}
      {dialog === 'pen' && (
        <Dialog isOpen onOpenChange={(o) => !o && setDialog(null)} title="Pen settings">
          <div className="p-5">
            <PenSettingsPanel />
          </div>
        </Dialog>
      )}
      {engine && dialog === 'paper' && <PaperDialogFor engine={engine} itemId={itemId} block={block} onClose={() => setDialog(null)} />}
    </div>
  );
}

function PaperDialogFor({ engine, itemId, block, onClose }: { engine: InkEngine; itemId: string; block: boolean; onClose: () => void }) {
  const [page] = useState(() => engine.currentPage());
  return page ? <PaperDialog itemId={itemId} page={page} block={block} onClose={onClose} /> : null;
}

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import type { InkEngine, InkTool } from '@/canvas/engine';
import type { PageBox } from '@/canvas/paper';
import { resolveInk } from '@/canvas/inkColours';
import type { InkElement } from '@/data/types';
import { objectUrlFor } from '@/data/repos/attachments';
import { cn } from '@/design/cn';

/**
 * Text boxes and images on ink pages (INK-14). They live in the engine's element layer,
 * which follows the camera, under the ink. With the text tool or lasso they can be picked:
 * tap to select, drag to move, the corner to resize, Delete to remove; the text tool (or
 * Enter) edits text. Everything goes through the engine, so Undo covers it.
 */

const LINE_HEIGHT = 1.35;
const MIN_W = 40;

function useObjectUrl(id: string | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    if (id) void objectUrlFor(id).then((u) => live && setUrl(u));
    return () => {
      live = false;
    };
  }, [id]);
  return url;
}

const textStyle = (el: InkElement, box: PageBox): CSSProperties => ({
  fontSize: el.fontSize,
  lineHeight: LINE_HEIGHT,
  color: resolveInk(el.colour, box.paper.colour),
  fontFamily: 'var(--font-sans)',
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
  padding: '2px 4px',
});

function TextEditor({ el, box, onDone }: { el: InkElement; box: PageBox; onDone: (text: string, h: number) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState(el.text);
  const fit = () => {
    const t = ref.current;
    if (!t) return;
    t.style.height = 'auto';
    t.style.height = `${t.scrollHeight}px`;
  };
  useLayoutEffect(fit, [text]);
  useEffect(() => {
    // After the frame: the tap that placed the box would otherwise move focus back to the canvas.
    const f = requestAnimationFrame(() => ref.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(f);
  }, []);
  return (
    <textarea
      ref={ref}
      data-ink-element
      aria-label="Text box"
      value={text}
      rows={1}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onDone(text, ref.current?.scrollHeight ?? el.h)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          ref.current?.blur();
        }
      }}
      className="absolute resize-none border-0 bg-transparent outline-2 outline-focus outline-dashed"
      style={{ ...textStyle(el, box), left: el.x, top: el.y, width: el.w, pointerEvents: 'auto' }}
    />
  );
}

function ElementView({
  el,
  box,
  engine,
  zoom,
  interactive,
  selected,
  onSelect,
  onEdit,
}: {
  el: InkElement;
  box: PageBox;
  engine: InkEngine;
  zoom: number;
  interactive: boolean;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
}) {
  const url = useObjectUrl(el.kind === 'image' ? el.attachmentId : null);
  const [preview, setPreview] = useState<InkElement | null>(null);
  const drag = useRef<{ mode: 'move' | 'resize'; x: number; y: number; moved: boolean } | null>(null);
  const shown = preview ?? el;

  const start = (mode: 'move' | 'resize') => (e: PointerEvent<HTMLElement>) => {
    if (!interactive) return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    drag.current = { mode, x: e.clientX, y: e.clientY, moved: false };
    onSelect();
  };
  const move = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.x) / zoom;
    const dy = (e.clientY - d.y) / zoom;
    if (Math.hypot(dx, dy) * zoom > 3) d.moved = true;
    if (!d.moved) return;
    if (d.mode === 'move') setPreview({ ...el, x: Math.max(-el.w / 2, Math.min(box.w - el.w / 2, el.x + dx)), y: Math.max(0, Math.min(box.h - 20, el.y + dy)) });
    else {
      const w = Math.max(MIN_W, el.w + dx);
      setPreview({ ...el, w, h: el.kind === 'image' ? (el.h * w) / el.w : el.h });
    }
  };
  const end = () => {
    const d = drag.current;
    drag.current = null;
    if (d?.moved && preview) engine.updateElement(preview);
    else if (d && !d.moved && el.kind === 'text' && engine.tool === 'text') onEdit();
    setPreview(null);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    const handled = () => {
      e.preventDefault();
      e.stopPropagation();
    };
    const step = e.shiftKey ? 10 : 1;
    const nudge: Record<string, [number, number]> = { ArrowUp: [0, -step], ArrowDown: [0, step], ArrowLeft: [-step, 0], ArrowRight: [step, 0] };
    if (e.key === 'Delete' || e.key === 'Backspace') return void (handled(), engine.removeElement(el.id));
    if (e.key === 'Enter' && el.kind === 'text') return void (handled(), onEdit());
    const n = nudge[e.key];
    if (n) return void (handled(), engine.updateElement({ ...el, x: el.x + n[0], y: el.y + n[1] }));
  };

  const handle = 22 / zoom;
  return (
    <div
      data-ink-element
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : -1}
      aria-label={el.kind === 'text' ? `Text box: ${el.text}` : 'Image'}
      aria-pressed={interactive ? selected : undefined}
      onPointerDown={start('move')}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={() => {
        drag.current = null;
        setPreview(null);
      }}
      onDoubleClick={() => el.kind === 'text' && onEdit()}
      onFocus={() => interactive && onSelect()}
      onKeyDown={interactive ? onKeyDown : undefined}
      className={cn('absolute touch-none select-none', interactive && 'cursor-move', selected && 'outline-focus outline-dashed')}
      style={{
        left: shown.x,
        top: shown.y,
        width: shown.w,
        height: el.kind === 'image' ? shown.h : undefined,
        minHeight: el.kind === 'text' ? el.fontSize * LINE_HEIGHT : undefined,
        outlineWidth: selected ? 2 / zoom : undefined,
        pointerEvents: interactive ? 'auto' : 'none',
        ...(el.kind === 'text' ? textStyle(el, box) : {}),
      }}
    >
      {el.kind === 'text' ? el.text : url && <img src={url} alt="" draggable={false} className="block h-full w-full" />}
      {selected && interactive && (
        <span
          data-ink-element
          aria-hidden
          onPointerDown={start('resize')}
          onPointerMove={move}
          onPointerUp={end}
          className="absolute rounded-full border-2 border-surface bg-focus"
          style={{ width: handle, height: handle, right: -handle / 2, bottom: -handle / 2, cursor: 'nwse-resize', borderWidth: 2 / zoom }}
        />
      )}
    </div>
  );
}

export interface DraftText {
  el: InkElement;
  isNew: boolean;
}

export function ElementsLayer({
  engine,
  tool,
  zoom,
  version,
  editing,
  setEditing,
  onSay,
}: {
  engine: InkEngine;
  tool: InkTool;
  zoom: number;
  /** Re-render when elements or the page layout change. */
  version: string;
  editing: DraftText | null;
  setEditing: (d: DraftText | null) => void;
  onSay: (msg: string) => void;
}) {
  const [picked, setSelected] = useState<string | null>(null);
  const interactive = tool === 'text' || tool === 'lasso';
  const selected = interactive ? picked : null;

  const finish = (text: string, h: number) => {
    if (!editing) return;
    const el = { ...editing.el, text: text.replace(/\s+$/, ''), h };
    setEditing(null);
    if (!el.text.trim()) {
      if (!editing.isNew) {
        engine.removeElement(el.id);
        onSay('Empty text box removed.');
      }
      return;
    }
    if (editing.isNew) engine.addElement(el);
    else if (el.text !== editing.el.text || el.h !== editing.el.h) engine.updateElement(el);
  };

  void version; // only here to re-render
  return createPortal(
    <>
      {engine.pageBoxes.map((box) => (
        <div key={box.id} className="absolute overflow-hidden" style={{ left: box.x, top: box.y, width: box.w, height: box.h }}>
          {engine.elements(box.id).map((el) =>
            editing?.el.id === el.id ? null : (
              <ElementView
                key={el.id}
                el={el}
                box={box}
                engine={engine}
                zoom={zoom}
                interactive={interactive}
                selected={selected === el.id}
                onSelect={() => setSelected(el.id)}
                onEdit={() => setEditing({ el, isNew: false })}
              />
            ),
          )}
          {editing && editing.el.pageId === box.id && <TextEditor key={editing.el.id} el={editing.el} box={box} onDone={finish} />}
        </div>
      ))}
    </>,
    engine.elementLayer,
  );
}

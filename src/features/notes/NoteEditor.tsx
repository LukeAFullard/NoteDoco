import { useCallback, useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Editor } from '@tiptap/core';
import { CalendarClock, Code2, History, Maximize2, Minimize2, Search, Type } from 'lucide-react';
import { db } from '@/data/db';
import { reportStorageError } from '@/data/health';
import { setBodyText } from '@/data/repos/items';
import { addAttachment, attachmentIdFromUrl, objectUrlFor } from '@/data/repos/attachments';
import type { Item, NoteBody } from '@/data/types';
import { IconButton } from '@/design/Button';
import { Menu, MenuItem } from '@/design/Menu';
import { cn } from '@/design/cn';
import { useDebouncedSave } from '@/lib/useDebouncedSave';
import { useKeyboardInset } from '@/lib/useKeyboardInset';
import { openDateDialog, useUi } from '@/app/ui';
import { useIsActivePane } from '@/app/paneContext';
import { resolveDateMentions } from '@/lib/dateMentions';
import { DateBadge, DoneToggle } from '@/features/time/DateBadge';
import { noteExtensions } from './editor/extensions';
import { Toolbar } from './editor/Toolbar';
import { FindBar } from './editor/FindBar';
import { INSERT_IMAGE_EVENT, INSERT_SKETCH_EVENT } from './editor/slashCommands';
import { createSketch, sketchUrl } from '@/data/repos/ink';
import { openSketch } from '@/features/ink/sketchDialog';
import { TagEditor } from '@/features/tags/TagEditor';
import { SNAPSHOT_INTERVAL_MS, snapshotNote } from '@/data/repos/versions';
import { HistoryDialog } from './HistoryDialog';
import { OPEN_HISTORY_EVENT } from '@/features/items/events';

type Mode = 'rich' | 'source';
type SaveState = 'saved' | 'saving' | 'failed';

async function insertImages(editor: Editor, itemId: string, files: File[], pos?: number) {
  for (const f of files) {
    const att = await addAttachment(itemId, f);
    const node = f.type.startsWith('image/')
      ? { type: 'image', attrs: { src: `ndoco:attachment/${att.id}`, alt: f.name } }
      : { type: 'text', text: f.name, marks: [{ type: 'link', attrs: { href: `ndoco:attachment/${att.id}` } }] };
    if (pos !== undefined) editor.chain().insertContentAt(pos, node).run();
    else editor.chain().focus().insertContent(node).run();
  }
}

/** Opens an attachment link (ndoco:attachment/<id>) in a new tab. */
async function openAttachment(href: string) {
  const id = attachmentIdFromUrl(href);
  const url = id ? await objectUrlFor(id) : href;
  if (url) window.open(url, '_blank', 'noopener');
}

function RichEditor({ item, body, onChange, findOpen, setFindOpen }: {
  item: Item;
  body: NoteBody;
  onChange: (md: string) => void;
  findOpen: boolean;
  setFindOpen: (o: boolean) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const inset = useKeyboardInset();
  const editor = useEditor({
    extensions: noteExtensions(),
    content: body.text,
    contentType: 'markdown',
    autofocus: body.text ? false : 'start',
    editorProps: {
      attributes: { class: 'note-content', 'aria-label': 'Note', role: 'textbox', 'aria-multiline': 'true' },
      handlePaste: (_view, event) => {
        const files = [...(event.clipboardData?.files ?? [])];
        if (!files.length || !editor) return false;
        void insertImages(editor, item.id, files);
        return true;
      },
      handleDrop: (view, event) => {
        const files = [...(event.dataTransfer?.files ?? [])];
        if (!files.length || !editor) return false;
        const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        void insertImages(editor, item.id, files, pos);
        return true;
      },
      handleClickOn: (_view, _pos, _node, _nodePos, event) => {
        const a = (event.target as HTMLElement).closest('a');
        if (!a) return false;
        const href = a.getAttribute('href') ?? '';
        if (!(event.metaKey || event.ctrlKey || href.startsWith('ndoco:'))) return false;
        event.preventDefault();
        void openAttachment(href);
        return true;
      },
    },
    onUpdate: ({ editor: e }) => onChange(e.getMarkdown()),
  });

  useEffect(() => {
    const onInsert = () => fileInput.current?.click();
    window.addEventListener(INSERT_IMAGE_EVENT, onInsert);
    return () => window.removeEventListener(INSERT_IMAGE_EVENT, onInsert);
  }, []);

  // A sketch block (NOTE-8): a new ink document owned by this note, then straight into drawing.
  useEffect(() => {
    const onSketch = (ev: Event) => {
      if (!editor || (ev as CustomEvent<{ editor: Editor }>).detail?.editor !== editor) return;
      void createSketch(item.id).then((docId) => {
        editor.chain().focus().insertContent([{ type: 'image', attrs: { src: sketchUrl(docId), alt: 'sketch' } }, { type: 'paragraph' }]).run();
        openSketch(docId);
      });
    };
    window.addEventListener(INSERT_SKETCH_EVENT, onSketch);
    return () => window.removeEventListener(INSERT_SKETCH_EVENT, onSketch);
  }, [editor, item.id]);

  if (!editor) return null;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="hidden border-b border-border md:block">
        <Toolbar editor={editor} onImage={() => fileInput.current?.click()} />
      </div>
      {findOpen && <FindBar editor={editor} onClose={() => { setFindOpen(false); editor.commands.focus(); }} />}
      <div className="min-h-0 flex-1 overflow-y-auto" onClick={(e) => e.target === e.currentTarget && editor.commands.focus('end')}>
        <EditorContent editor={editor} className="mx-auto w-full max-w-3xl px-5 py-6 sm:px-8" />
      </div>
      {/* Phones and tablets: formatting bar just above the on-screen keyboard. */}
      <div className="border-t border-border bg-surface md:hidden" style={{ marginBottom: inset }}>
        <Toolbar editor={editor} onImage={() => fileInput.current?.click()} />
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          void insertImages(editor, item.id, [...(e.target.files ?? [])]);
          e.target.value = '';
        }}
      />
    </div>
  );
}

function PlainEditor({ text, onChange, mono, label }: { text: string; onChange: (t: string) => void; mono: boolean; label: string }) {
  const [value, setValue] = useState(text);
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <textarea
        aria-label={label}
        value={value}
        autoFocus={!text}
        spellCheck
        onChange={(e) => {
          // "@fri " becomes "@2026-10-02 " as you type; keep the caret where it was.
          const el = e.target;
          const next = resolveDateMentions(el.value);
          if (next !== el.value) {
            const caret = el.selectionStart + (next.length - el.value.length);
            requestAnimationFrame(() => el.setSelectionRange(caret, caret));
          }
          setValue(next);
          onChange(next);
        }}
        placeholder="Write here. The first line becomes the title."
        className={cn(
          'mx-auto block h-full min-h-[60vh] w-full max-w-3xl resize-none bg-transparent px-5 py-6 leading-relaxed outline-none sm:px-8',
          mono ? 'font-mono text-sm' : 'text-base',
        )}
      />
    </div>
  );
}

/** Typed notes: rich Markdown editing (saved as plain Markdown), source mode, or plain text. */
export function NoteEditor({ item }: { item: Item }) {
  const [body, setBody] = useState<NoteBody | null>(null);
  const [mode, setMode] = useState<Mode>('rich');
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [findOpen, setFindOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const focusMode = useUi((s) => s.focusMode);
  const isActive = useIsActivePane();
  const latest = useRef<string | null>(null);
  /** The text as this editor last loaded or saved it. */
  const savedText = useRef<string | null>(null);

  // Load the body once per note; later changes normally come from this editor.
  useEffect(() => {
    let cancelled = false;
    void db.noteBodies.get(item.id).then((b) => {
      if (cancelled) return;
      savedText.current = b?.text ?? '';
      setBody(b ?? { itemId: item.id, format: 'markdown', text: '' });
    });
    return () => {
      cancelled = true;
    };
  }, [item.id]);

  // Changed somewhere else (a checklist line ticked in Today, another pane, a repeat moving
  // on): reload, unless there are edits here still waiting to save, so they never overwrite it.
  const stored = useLiveQuery(() => db.noteBodies.get(item.id), [item.id]);
  useEffect(() => {
    if (!stored || savedText.current === null || stored.text === savedText.current || saveState !== 'saved') return;
    savedText.current = stored.text;
    latest.current = null;
    setBody(stored);
    setReloadKey((k) => k + 1);
  }, [stored, saveState]);

  const { schedule, flush } = useDebouncedSave(async (text: string) => {
    try {
      savedText.current = text;
      await setBodyText(item.id, text);
    } catch (err) {
      // The text stays in the editor; the next change tries again. The banner says why.
      setSaveState('failed');
      reportStorageError(err);
      return;
    }
    setSaveState('saved');
    // A version every few minutes while editing (history, SAFE-5).
    await snapshotNote(item.id, 'idle', SNAPSHOT_INTERVAL_MS);
  }, 500);

  // A baseline version on open, and one when leaving the note (both skipped if unchanged).
  useEffect(() => {
    void snapshotNote(item.id, 'idle');
    return () => {
      void flush().then(() => snapshotNote(item.id, 'idle'));
    };
  }, [item.id, flush]);

  /** After restoring a version, reload the editor with the restored text. */
  const reloadFromDb = async () => {
    const b = await db.noteBodies.get(item.id);
    if (b) {
      savedText.current = b.text;
      setBody(b);
    }
    latest.current = null;
    setReloadKey((k) => k + 1);
    setHistoryOpen(false);
  };

  const onChange = useCallback(
    (text: string) => {
      latest.current = text;
      setSaveState('saving');
      schedule(text);
    },
    [schedule],
  );

  const switchMode = async (next: Mode) => {
    await flush();
    const fresh = await db.noteBodies.get(item.id);
    if (fresh) setBody(fresh);
    setMode(next);
  };

  const setFormat = async (format: NoteBody['format']) => {
    await flush();
    const text = latest.current ?? body?.text ?? '';
    savedText.current = text;
    await setBodyText(item.id, text, format);
    setBody({ itemId: item.id, format, text });
    setMode('rich');
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isActive()) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f' && body?.format === 'markdown' && mode === 'rich') {
        e.preventDefault();
        setFindOpen(true);
      }
      if (e.key === 'Escape' && useUi.getState().focusMode) useUi.setState({ focusMode: false });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [body?.format, mode, isActive]);

  useEffect(() => () => useUi.setState({ focusMode: false }), []);

  // The inspector's "Version history" button.
  useEffect(() => {
    const onOpen = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== item.id) return;
      void flush().then(() => setHistoryOpen(true));
    };
    window.addEventListener(OPEN_HISTORY_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_HISTORY_EVENT, onOpen);
  }, [item.id, flush]);

  if (!body) return null;
  const plain = body.format === 'plain';

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-1 border-b border-border px-3 py-1.5 text-xs text-muted">
        <span aria-live="polite" className="mr-auto font-mono">
          {saveState === 'saving' ? 'Saving…' : saveState === 'failed' ? 'Not saved' : 'Saved'} · {item.stats.words} {item.stats.words === 1 ? 'word' : 'words'}
        </span>
        {!plain && mode === 'rich' && (
          <IconButton label="Find and replace (Ctrl+F)" size="sm" onPress={() => setFindOpen(!findOpen)}>
            <Search size={16} />
          </IconButton>
        )}
        {!plain && (
          <IconButton label={mode === 'rich' ? 'Edit as Markdown' : 'Back to rich editing'} size="sm" onPress={() => void switchMode(mode === 'rich' ? 'source' : 'rich')}>
            {mode === 'rich' ? <Code2 size={16} /> : <Type size={16} />}
          </IconButton>
        )}
        <Menu label="Note format" trigger={<IconButton label="Note format" size="sm"><span className="font-mono text-[11px]">{plain ? 'TXT' : 'MD'}</span></IconButton>}>
          <MenuItem onAction={() => void setFormat('markdown')}>{!plain && '✓ '}Formatted (Markdown)</MenuItem>
          <MenuItem onAction={() => void setFormat('plain')}>{plain && '✓ '}Plain text (no formatting)</MenuItem>
        </Menu>
        <IconButton label="Version history" size="sm" onPress={async () => { await flush(); setHistoryOpen(true); }}>
          <History size={16} />
        </IconButton>
        <IconButton label={focusMode ? 'Leave focus mode (Esc)' : 'Focus mode'} size="sm" onPress={() => useUi.setState({ focusMode: !focusMode })}>
          {focusMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </IconButton>
      </div>
      {!focusMode && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border px-4 py-1.5">
          <DoneToggle item={item} />
          <button
            type="button"
            onClick={() => openDateDialog([item.id])}
            className="flex items-center gap-1.5 rounded text-sm text-muted outline-none hover:text-text focus-visible:ring-2 focus-visible:ring-focus"
          >
            <CalendarClock size={15} aria-hidden />
            {item.when || item.due ? <DateBadge item={item} /> : <span>Add date</span>}
          </button>
          <div className="min-w-0 flex-1">
            <TagEditor item={item} />
          </div>
        </div>
      )}
      {plain ? (
        <PlainEditor key={`${item.id}-plain-${reloadKey}`} text={body.text} onChange={onChange} mono label="Plain-text note" />
      ) : mode === 'source' ? (
        <PlainEditor key={`${item.id}-source-${reloadKey}`} text={body.text} onChange={onChange} mono label="Markdown source" />
      ) : (
        <RichEditor key={`${item.id}-rich-${reloadKey}`} item={item} body={body} onChange={onChange} findOpen={findOpen} setFindOpen={setFindOpen} />
      )}
      {historyOpen && <HistoryDialog itemId={item.id} onClose={() => setHistoryOpen(false)} onRestored={() => void reloadFromDb()} />}
    </div>
  );
}

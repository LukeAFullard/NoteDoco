import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Trash2, Maximize2, Minimize2, History as HistoryIcon, Copy } from 'lucide-react';
import { getNote, putNote, deleteNote as dbDeleteNote, getNoteVersions, putNoteVersion } from '../db';
import type { Note, NoteVersion, Recurrence } from '../types';
import { shouldResetRecurringChecklist, resetChecklistItems, duplicateNote } from '../utils/recurrence';
import { toggleChecklistLine } from '../utils/markdownChecklist';
import { shouldCreateSnapshot } from '../utils/noteHistory';
import { useDebouncedCallback } from '../hooks/useDebouncedCallback';
import { NotePreview } from '../components/notes/NotePreview';
import { NoteHistoryModal } from '../components/notes/NoteHistoryModal';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

type SaveState = 'idle' | 'saving' | 'saved';

export function NoteEditor() {
  const { noteId } = useParams<{ noteId: string }>();
  const navigate = useNavigate();
  const [note, setNote] = useState<Note | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [goalDate, setGoalDate] = useState('');
  const [recurrence, setRecurrence] = useState<Recurrence>('none');
  const [mobileTab, setMobileTab] = useState<'edit' | 'preview'>('edit');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [focusMode, setFocusMode] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const loadedRef = useRef(false);
  const lastSnapshotAtRef = useRef<string | null>(null);

  useEffect(() => {
    if (!noteId) return;
    loadedRef.current = false;
    getNote(noteId).then(async (found) => {
      if (!found) return;

      let effectiveNote = found;
      if (shouldResetRecurringChecklist(found)) {
        const resetAt = new Date().toISOString();
        await putNoteVersion({
          id: crypto.randomUUID(),
          noteId: found.id,
          title: found.title,
          contentMarkdown: found.contentMarkdown,
          goalDate: found.goalDate,
          savedAt: resetAt,
        });
        effectiveNote = {
          ...found,
          contentMarkdown: resetChecklistItems(found.contentMarkdown),
          lastRecurredAt: resetAt,
          updatedAt: resetAt,
        };
        await putNote(effectiveNote);
      }

      setNote(effectiveNote);
      setTitle(effectiveNote.title);
      setContent(effectiveNote.contentMarkdown);
      setGoalDate(effectiveNote.goalDate ?? '');
      setRecurrence(effectiveNote.recurrence ?? 'none');

      const versions = await getNoteVersions(effectiveNote.id);
      if (versions.length === 0) {
        const baseline: NoteVersion = {
          id: crypto.randomUUID(),
          noteId: effectiveNote.id,
          title: effectiveNote.title,
          contentMarkdown: effectiveNote.contentMarkdown,
          goalDate: effectiveNote.goalDate,
          savedAt: effectiveNote.updatedAt,
        };
        await putNoteVersion(baseline);
        lastSnapshotAtRef.current = baseline.savedAt;
      } else {
        const mostRecent = [...versions].sort((a, b) => (a.savedAt > b.savedAt ? -1 : 1))[0];
        lastSnapshotAtRef.current = mostRecent.savedAt;
      }

      loadedRef.current = true;
    });
  }, [noteId]);

  useEffect(() => {
    setFocusMode(false);
    setShowHistory(false);
  }, [noteId]);

  useEffect(() => {
    if (!focusMode) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFocusMode(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [focusMode]);

  const persist = useDebouncedCallback(async (updates: Partial<Note>) => {
    if (!note) return;
    setSaveState('saving');
    const updated: Note = { ...note, ...updates, updatedAt: new Date().toISOString() };
    await putNote(updated);
    setNote(updated);
    setSaveState('saved');

    if (shouldCreateSnapshot(lastSnapshotAtRef.current, new Date(updated.updatedAt))) {
      await putNoteVersion({
        id: crypto.randomUUID(),
        noteId: updated.id,
        title: updated.title,
        contentMarkdown: updated.contentMarkdown,
        goalDate: updated.goalDate,
        savedAt: updated.updatedAt,
      });
      lastSnapshotAtRef.current = updated.updatedAt;
    }
  }, 500);

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (loadedRef.current) persist({ title: value });
  };

  const handleContentChange = (value: string) => {
    setContent(value);
    if (loadedRef.current) persist({ contentMarkdown: value });
  };

  const handleGoalDateChange = (value: string) => {
    setGoalDate(value);
    if (loadedRef.current) persist({ goalDate: value || null });
  };

  const handleRecurrenceChange = (value: Recurrence) => {
    setRecurrence(value);
    if (loadedRef.current) persist({ recurrence: value });
  };

  const handleDuplicate = async () => {
    if (!note) return;
    const copy = duplicateNote(note);
    await putNote(copy);
    navigate(`/notes/${copy.id}`);
  };

  const handleToggleLine = (lineIndex: number) => {
    const newContent = toggleChecklistLine(content, lineIndex);
    setContent(newContent);
    persist({ contentMarkdown: newContent });
  };

  const handleRestore = async (version: NoteVersion) => {
    if (!note) return;
    const currentSnapshotAt = new Date().toISOString();
    await putNoteVersion({
      id: crypto.randomUUID(),
      noteId: note.id,
      title,
      contentMarkdown: content,
      goalDate: goalDate || null,
      savedAt: currentSnapshotAt,
    });

    const restored: Note = {
      ...note,
      title: version.title,
      contentMarkdown: version.contentMarkdown,
      goalDate: version.goalDate,
      updatedAt: new Date().toISOString(),
    };
    await putNote(restored);
    setNote(restored);
    setTitle(restored.title);
    setContent(restored.contentMarkdown);
    setGoalDate(restored.goalDate ?? '');
    lastSnapshotAtRef.current = restored.updatedAt;
    setShowHistory(false);
  };

  const handleDelete = async () => {
    if (!note) return;
    if (!window.confirm('Delete this note? This cannot be undone.')) return;
    await dbDeleteNote(note.id);
    navigate(note.projectId ? `/projects/${note.projectId}` : '/unfiled');
  };

  if (!note) return null;

  const backHref = note.projectId ? `/projects/${note.projectId}` : '/unfiled';

  return (
    <div className={focusMode ? 'fixed inset-0 z-50 bg-white dark:bg-graphite flex flex-col' : 'flex flex-col h-full'}>
      <div className="flex items-center justify-between p-4 border-b border-graphite/10 dark:border-white/10">
        {focusMode ? (
          <span className="text-sm text-gray-500 dark:text-gray-400">Focus mode</span>
        ) : (
          <Link to={backHref} className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300 hover:text-signal">
            <ArrowLeft size={16} /> Back
          </Link>
        )}
        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-500 dark:text-gray-400 tabular">
            {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : ''}
          </span>
          {!focusMode && (
            <>
              <button
                type="button"
                onClick={() => setShowHistory(true)}
                aria-label="History"
                className="text-gray-500 dark:text-gray-400 hover:text-signal"
              >
                <HistoryIcon size={16} />
              </button>
              <button
                type="button"
                onClick={handleDuplicate}
                aria-label="Duplicate note"
                className="text-gray-500 dark:text-gray-400 hover:text-signal"
              >
                <Copy size={16} />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setFocusMode((v) => !v)}
            aria-label={focusMode ? 'Exit focus mode' : 'Enter focus mode'}
            className="text-gray-500 dark:text-gray-400 hover:text-signal"
          >
            {focusMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          {!focusMode && (
            <Button variant="ghost" size="sm" onClick={handleDelete} className="gap-1 text-rust">
              <Trash2 size={14} /> Delete
            </Button>
          )}
        </div>
      </div>

      <div className="p-4 border-b border-graphite/10 dark:border-white/10 flex flex-col sm:flex-row gap-3">
        <Input value={title} onChange={(e) => handleTitleChange(e.target.value)} placeholder="Untitled note" className="text-lg font-semibold flex-1" />
        {!focusMode && (
          <>
            <input
              type="date"
              value={goalDate}
              onChange={(e) => handleGoalDateChange(e.target.value)}
              className="px-3 py-2 border border-graphite/20 dark:border-white/20 rounded-panel bg-white dark:bg-graphite text-graphite dark:text-stone text-sm"
            />
            <select
              value={recurrence}
              onChange={(e) => handleRecurrenceChange(e.target.value as Recurrence)}
              className="px-3 py-2 border border-graphite/20 dark:border-white/20 rounded-panel bg-white dark:bg-graphite text-graphite dark:text-stone text-sm"
            >
              <option value="none">No repeat</option>
              <option value="daily">Repeats daily</option>
              <option value="weekly">Repeats weekly</option>
              <option value="monthly">Repeats monthly</option>
            </select>
          </>
        )}
      </div>

      <div className="md:hidden flex border-b border-graphite/10 dark:border-white/10">
        <button type="button" onClick={() => setMobileTab('edit')} className={`flex-1 py-2 text-sm font-medium ${mobileTab === 'edit' ? 'text-signal border-b-2 border-signal' : 'text-gray-500'}`}>
          Edit
        </button>
        <button type="button" onClick={() => setMobileTab('preview')} className={`flex-1 py-2 text-sm font-medium ${mobileTab === 'preview' ? 'text-signal border-b-2 border-signal' : 'text-gray-500'}`}>
          Preview
        </button>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 overflow-hidden">
        <textarea
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          placeholder="Write in markdown. Use '- [ ] task' for checklist items."
          className={`h-full resize-none p-4 font-mono text-sm bg-white dark:bg-graphite text-graphite dark:text-stone focus:outline-none border-r border-graphite/10 dark:border-white/10 ${
            mobileTab === 'preview' ? 'hidden md:block' : ''
          }`}
        />
        <div className={`h-full overflow-y-auto p-4 ${mobileTab === 'edit' ? 'hidden md:block' : ''}`}>
          <NotePreview content={content} onToggleLine={handleToggleLine} />
        </div>
      </div>

      {showHistory && note && (
        <NoteHistoryModal noteId={note.id} onClose={() => setShowHistory(false)} onRestore={handleRestore} />
      )}
    </div>
  );
}

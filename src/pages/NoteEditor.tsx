import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Trash2, Maximize2, Minimize2 } from 'lucide-react';
import { getNote, putNote, deleteNote as dbDeleteNote } from '../db';
import type { Note } from '../types';
import { toggleChecklistLine } from '../utils/markdownChecklist';
import { useDebouncedCallback } from '../hooks/useDebouncedCallback';
import { NotePreview } from '../components/notes/NotePreview';
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
  const [mobileTab, setMobileTab] = useState<'edit' | 'preview'>('edit');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [focusMode, setFocusMode] = useState(false);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!noteId) return;
    loadedRef.current = false;
    getNote(noteId).then((found) => {
      if (!found) return;
      setNote(found);
      setTitle(found.title);
      setContent(found.contentMarkdown);
      setGoalDate(found.goalDate ?? '');
      loadedRef.current = true;
    });
  }, [noteId]);

  // Focus mode is session-only: reset it whenever a different note loads.
  useEffect(() => {
    setFocusMode(false);
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

  const handleToggleLine = (lineIndex: number) => {
    const newContent = toggleChecklistLine(content, lineIndex);
    setContent(newContent);
    persist({ contentMarkdown: newContent });
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
          <input
            type="date"
            value={goalDate}
            onChange={(e) => handleGoalDateChange(e.target.value)}
            className="px-3 py-2 border border-graphite/20 dark:border-white/20 rounded-panel bg-white dark:bg-graphite text-graphite dark:text-stone text-sm"
          />
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
    </div>
  );
}

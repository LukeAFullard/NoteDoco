import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getNote } from '../db';
import type { Note } from '../types';

export function NoteEditor() {
  const { noteId } = useParams<{ noteId: string }>();
  const [note, setNote] = useState<Note | null>(null);

  useEffect(() => {
    if (noteId) {
      getNote(noteId).then((n) => setNote(n || null));
    }
  }, [noteId]);

  if (!note) return <div className="p-6">Loading or note not found...</div>;

  const backHref = note.projectId ? `/projects/${note.projectId}` : '/unfiled';

  return (
    <div className="p-6">
      <Link to={backHref} className="text-sm text-signal hover:underline">
        ← Back
      </Link>
      <h1 className="text-xl font-bold mt-4">{note.title || 'Untitled note'}</h1>
    </div>
  );
}

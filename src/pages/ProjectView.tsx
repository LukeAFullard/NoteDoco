import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, FileText } from 'lucide-react';
import { useProjects } from '../context/ProjectsContext';
import { getNotes, getNotesByProject, putNote } from '../db';
import type { Note } from '../types';
import { Panel } from '../components/ui/Panel';
import { Button } from '../components/ui/Button';

export function ProjectView() {
  const { projectId = null } = useParams<{ projectId?: string }>();
  const { projects, loading: projectsLoading } = useProjects();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    setLoadingNotes(true);
    const load = async () => {
      const all = projectId ? await getNotesByProject(projectId) : (await getNotes()).filter((n) => n.projectId === null);
      setNotes(all.filter((n) => !n.archived));
      setLoadingNotes(false);
    };
    load();
  }, [projectId]);

  if (projectsLoading || loadingNotes) return null;

  const project = projectId ? projects.find((p) => p.id === projectId) : null;
  const heading = projectId ? project?.name ?? 'Project not found' : 'Unfiled';

  const handleCreateNote = async () => {
    const now = new Date().toISOString();
    const note: Note = {
      id: crypto.randomUUID(),
      projectId,
      title: 'Untitled note',
      contentMarkdown: '',
      goalDate: null,
      archived: false,
      createdAt: now,
      updatedAt: now,
    };
    await putNote(note);
    navigate(`/notes/${note.id}`);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-graphite dark:text-stone">{heading}</h1>
        <Button variant="primary" size="sm" onClick={handleCreateNote} className="gap-2">
          <Plus size={16} /> New note
        </Button>
      </div>

      {notes.length === 0 ? (
        <Panel className="p-8 text-center text-gray-500 dark:text-gray-400">No notes yet.</Panel>
      ) : (
        <div className="space-y-2">
          {notes.map((note) => (
            <Panel key={note.id} className="p-4 flex items-center gap-3 cursor-pointer hover:border-signal/50" onClick={() => navigate(`/notes/${note.id}`)}>
              <FileText size={18} className="text-gray-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-graphite dark:text-stone truncate">{note.title || 'Untitled note'}</p>
                {note.goalDate && <p className="text-xs text-gray-500 dark:text-gray-400">Due {note.goalDate}</p>}
              </div>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}

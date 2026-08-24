import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getNotes } from '../db';
import { useProjects } from '../context/ProjectsContext';
import type { Note } from '../types';
import { getDueBucket, type DueBucket } from '../utils/dueDate';
import { getChecklistProgress } from '../utils/markdownChecklist';
import { Panel } from '../components/ui/Panel';

const BUCKET_LABEL: Record<DueBucket, string> = {
  overdue: 'Overdue',
  today: 'Due today',
  'this-week': 'Due this week',
  later: 'Later',
};

const BUCKET_ORDER: DueBucket[] = ['overdue', 'today', 'this-week', 'later'];

const DOT_CLASS: Record<string, string> = {
  signal: 'bg-signal',
  verdigris: 'bg-verdigris',
  rust: 'bg-rust',
  graphite: 'bg-graphite dark:bg-stone',
};

export function Dashboard() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const { projects } = useProjects();
  const navigate = useNavigate();

  useEffect(() => {
    getNotes().then((all) => {
      setNotes(all.filter((n) => !n.archived && n.goalDate));
      setLoading(false);
    });
  }, []);

  if (loading) return null;

  const buckets: Record<DueBucket, Note[]> = { overdue: [], today: [], 'this-week': [], later: [] };
  notes.forEach((note) => {
    buckets[getDueBucket(note.goalDate!)].push(note);
  });
  (Object.keys(buckets) as DueBucket[]).forEach((key) => {
    buckets[key].sort((a, b) => (a.goalDate! < b.goalDate! ? -1 : 1));
  });

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-graphite dark:text-stone mb-6">Up Next</h1>

      {notes.length === 0 && (
        <Panel className="p-8 text-center text-gray-500 dark:text-gray-400">
          Nothing due — add a goal date to a note to see it here.
        </Panel>
      )}

      {BUCKET_ORDER.filter((bucket) => buckets[bucket].length > 0).map((bucket) => (
        <div key={bucket} className="mb-6">
          <h2 className={`text-sm font-semibold uppercase tracking-wide mb-2 ${bucket === 'overdue' ? 'text-rust' : 'text-gray-500 dark:text-gray-400'}`}>
            {BUCKET_LABEL[bucket]}
          </h2>
          <div className="space-y-2">
            {buckets[bucket].map((note) => {
              const project = note.projectId ? projects.find((p) => p.id === note.projectId) : null;
              const progress = getChecklistProgress(note.contentMarkdown);
              return (
                <Panel key={note.id} className="p-4 flex items-center gap-3 cursor-pointer hover:border-signal/50" onClick={() => navigate(`/notes/${note.id}`)}>
                  <span className={`w-2 h-2 rounded-full shrink-0 ${DOT_CLASS[project?.color ?? 'graphite']}`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-graphite dark:text-stone truncate">{note.title || 'Untitled note'}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {project ? project.name : 'Unfiled'} · Due {note.goalDate}
                      {progress && ` · ${progress.checked}/${progress.total} done`}
                    </p>
                  </div>
                </Panel>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

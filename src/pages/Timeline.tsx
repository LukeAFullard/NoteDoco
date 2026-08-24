import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getNotes } from '../db';
import { useProjects } from '../context/ProjectsContext';
import type { Note, Project } from '../types';
import { getTimelineColumnIndex, getTimelineColumns } from '../utils/dueDate';
import { Panel } from '../components/ui/Panel';

const DOT_CLASS: Record<string, string> = {
  signal: 'bg-signal',
  verdigris: 'bg-verdigris',
  rust: 'bg-rust',
  graphite: 'bg-graphite dark:bg-stone',
};

interface Row {
  key: string;
  label: string;
  color: Project['color'];
  notesByColumn: Note[][];
}

export function Timeline() {
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

  const columns = getTimelineColumns();
  const activeProjects = projects.filter((p) => !p.archived);

  const buildRow = (key: string, label: string, color: Project['color'], projectId: string | null): Row => {
    const notesByColumn: Note[][] = columns.map(() => []);
    notes
      .filter((n) => n.projectId === projectId)
      .forEach((note) => {
        notesByColumn[getTimelineColumnIndex(note.goalDate!)].push(note);
      });
    return { key, label, color, notesByColumn };
  };

  const rows: Row[] = [
    ...activeProjects.map((p) => buildRow(p.id, p.name, p.color, p.id)),
    buildRow('unfiled', 'Unfiled', 'graphite', null),
  ].filter((row) => row.notesByColumn.some((col) => col.length > 0));

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-graphite dark:text-stone mb-6">Timeline</h1>

      {rows.length === 0 ? (
        <Panel className="p-8 text-center text-gray-500 dark:text-gray-400">
          Nothing to show — add goal dates to notes to see them on the timeline.
        </Panel>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[900px]">
            <div className="grid grid-cols-[160px_repeat(7,1fr)] gap-2 mb-2">
              <div />
              {columns.map((col, i) => (
                <div key={i} className={`text-xs font-semibold uppercase tracking-wide ${i === 0 ? 'text-rust' : 'text-gray-500 dark:text-gray-400'}`}>
                  {col.label}
                </div>
              ))}
            </div>

            {rows.map((row) => (
              <div key={row.key} className="grid grid-cols-[160px_repeat(7,1fr)] gap-2 mb-2 items-start">
                <div className="flex items-center gap-2 pt-2">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${DOT_CLASS[row.color]}`} />
                  <span className="text-sm font-medium text-graphite dark:text-stone truncate">{row.label}</span>
                </div>
                {row.notesByColumn.map((colNotes, i) => (
                  <div key={i} className="space-y-1">
                    {colNotes.map((note) => (
                      <button
                        key={note.id}
                        type="button"
                        onClick={() => navigate(`/notes/${note.id}`)}
                        className="w-full text-left text-xs px-2 py-1 rounded-panel bg-signal/10 hover:bg-signal/20 text-graphite dark:text-stone truncate"
                      >
                        {note.title || 'Untitled note'}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

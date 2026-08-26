import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search as SearchIcon, Hash } from 'lucide-react';
import { getNotes } from '../db';
import { useProjects } from '../context/ProjectsContext';
import type { Note } from '../types';
import { searchNotes, getAllTags, getMatchSnippet } from '../utils/search';
import { Panel } from '../components/ui/Panel';
import { Input } from '../components/ui/Input';

export function Browse() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const { projects } = useProjects();
  const navigate = useNavigate();

  useEffect(() => {
    getNotes().then((all) => {
      setNotes(all.filter((n) => !n.archived));
      setLoading(false);
    });
  }, []);

  const tags = useMemo(() => getAllTags(notes), [notes]);
  const results = useMemo(() => searchNotes(notes, query), [notes, query]);

  if (loading) return null;

  const projectName = (projectId: string | null) => {
    if (!projectId) return 'Unfiled';
    return projects.find((p) => p.id === projectId)?.name ?? 'Unfiled';
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-graphite dark:text-stone mb-6">Search</h1>

      <div className="relative mb-6">
        <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search notes, or type #tag"
          className="pl-9"
        />
      </div>

      {query.trim() === '' ? (
        tags.length === 0 ? (
          <Panel className="p-8 text-center text-gray-500 dark:text-gray-400">
            No tags yet — add #tags anywhere in a note to see them here.
          </Panel>
        ) : (
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">Tags</h2>
            <div className="flex flex-wrap gap-2">
              {tags.map(({ tag, count }) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setQuery(`#${tag}`)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-panel text-sm border border-graphite/10 dark:border-white/10 hover:border-signal/40 hover:bg-gray-100/60 dark:hover:bg-gray-800/60 text-graphite dark:text-stone"
                >
                  <Hash size={12} className="text-signal" />
                  {tag}
                  <span className="text-gray-400">{count}</span>
                </button>
              ))}
            </div>
          </div>
        )
      ) : results.length === 0 ? (
        <Panel className="p-8 text-center text-gray-500 dark:text-gray-400">No notes match "{query}".</Panel>
      ) : (
        <div className="space-y-2">
          {results.map((note) => (
            <Panel key={note.id} className="p-4 cursor-pointer hover:border-signal/50" onClick={() => navigate(`/notes/${note.id}`)}>
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="font-medium text-graphite dark:text-stone truncate">{note.title || 'Untitled note'}</p>
                <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">{projectName(note.projectId)}</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 truncate">{getMatchSnippet(note.contentMarkdown, query)}</p>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}

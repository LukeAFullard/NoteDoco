import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Plus, Inbox, Archive, ListChecks, CalendarRange, Settings as SettingsIcon } from 'lucide-react';
import { useProjects } from '../../context/ProjectsContext';
import { ProjectTreeItem } from './ProjectTreeItem';
import { ProjectFormModal } from './ProjectFormModal';
import { TimeDocoLink } from './TimeDocoLink';
import { Button } from '../ui/Button';

export function Sidebar() {
  const { projects, createProject } = useProjects();
  const location = useLocation();
  const [creating, setCreating] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const visibleProjects = projects.filter((p) => showArchived || !p.archived);
  const rootProjects = visibleProjects.filter((p) => p.parentId === null);

  return (
    <aside className="w-64 shrink-0 h-full flex flex-col bg-stone dark:bg-ink border-r border-graphite/10 dark:border-white/10">
      <div className="p-3 border-b border-graphite/10 dark:border-white/10">
        <Link to="/" className="text-lg font-bold text-graphite dark:text-stone">Note<span className="text-signal">Doco</span></Link>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <Link
          to="/"
          className={`flex items-center gap-2 px-2 py-1.5 rounded-panel text-sm mb-1 ${
            location.pathname === '/' ? 'bg-signal/10 text-signal-dim dark:text-signal font-medium' : 'text-graphite dark:text-stone hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          <ListChecks size={14} /> Up Next
        </Link>
        <Link
          to="/unfiled"
          className={`flex items-center gap-2 px-2 py-1.5 rounded-panel text-sm mb-1 ${
            location.pathname === '/unfiled' ? 'bg-signal/10 text-signal-dim dark:text-signal font-medium' : 'text-graphite dark:text-stone hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          <Inbox size={14} /> Unfiled
        </Link>
        <Link
          to="/timeline"
          className={`flex items-center gap-2 px-2 py-1.5 rounded-panel text-sm mb-2 ${
            location.pathname === '/timeline' ? 'bg-signal/10 text-signal-dim dark:text-signal font-medium' : 'text-graphite dark:text-stone hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          <CalendarRange size={14} /> Timeline
        </Link>

        {rootProjects.map((project) => (
          <ProjectTreeItem key={project.id} project={project} allProjects={visibleProjects} depth={0} />
        ))}
      </div>

      <div className="p-2 border-t border-graphite/10 dark:border-white/10 space-y-1">
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={() => setCreating(true)}>
          <Plus size={14} /> New project
        </Button>
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={() => setShowArchived((v) => !v)}>
          <Archive size={14} /> {showArchived ? 'Hide archived' : 'Show archived'}
        </Button>
        <Link
          to="/settings"
          className={`flex items-center gap-2 px-3 py-1.5 rounded-panel text-sm ${
            location.pathname === '/settings' ? 'bg-signal/10 text-signal-dim dark:text-signal font-medium' : 'text-graphite dark:text-stone hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          <SettingsIcon size={14} /> Settings
        </Link>
      </div>

      <div className="p-2 border-t border-graphite/10 dark:border-white/10">
        <TimeDocoLink />
      </div>

      {creating && (
        <ProjectFormModal
          title="New project"
          onClose={() => setCreating(false)}
          onSubmit={async (name, color) => {
            await createProject(name, color, null);
            setCreating(false);
          }}
        />
      )}
    </aside>
  );
}

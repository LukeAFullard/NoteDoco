import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronRight, Plus, Pencil, Archive, ArchiveRestore, Trash2 } from 'lucide-react';
import type { Project } from '../../types';
import { useProjects } from '../../context/ProjectsContext';
import { ProjectFormModal } from './ProjectFormModal';

const DOT_CLASS: Record<Project['color'], string> = {
  signal: 'bg-signal',
  verdigris: 'bg-verdigris',
  rust: 'bg-rust',
  graphite: 'bg-graphite dark:bg-stone',
};

interface ProjectTreeItemProps {
  project: Project;
  allProjects: Project[];
  depth: number;
}

export function ProjectTreeItem({ project, allProjects, depth }: ProjectTreeItemProps) {
  const { projectId: activeId } = useParams();
  const { updateProject, toggleArchiveProject, deleteProject, createProject } = useProjects();
  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState(false);
  const [addingChild, setAddingChild] = useState(false);

  const children = allProjects.filter((p) => p.parentId === project.id);
  const hasChildren = children.length > 0;
  const isActive = activeId === project.id;

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${project.name}"? Notes inside will become unfiled.`)) return;
    const result = await deleteProject(project.id);
    if (!result.ok && result.reason === 'has-children') {
      window.alert('This project has sub-projects. Delete or move them first.');
    }
  };

  return (
    <div>
      <div
        className={`group flex items-center gap-1 px-2 py-1.5 rounded-panel text-sm ${project.archived ? 'opacity-50' : ''} ${
          isActive ? 'bg-signal/10 text-signal-dim dark:text-signal font-medium' : 'text-graphite dark:text-stone hover:bg-gray-100 dark:hover:bg-gray-800'
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        <button type="button" onClick={() => setExpanded((v) => !v)} className={`shrink-0 ${hasChildren ? '' : 'invisible'}`} aria-label="Toggle sub-projects">
          <ChevronRight size={14} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </button>
        <span className={`w-2 h-2 rounded-full shrink-0 ${DOT_CLASS[project.color]}`} />
        <Link to={`/projects/${project.id}`} className="flex-1 truncate">{project.name}</Link>
        <div className="hidden group-hover:flex items-center gap-1 shrink-0">
          <button type="button" aria-label="Add sub-project" onClick={() => setAddingChild(true)}><Plus size={14} /></button>
          <button type="button" aria-label="Rename" onClick={() => setEditing(true)}><Pencil size={14} /></button>
          <button type="button" aria-label={project.archived ? 'Unarchive' : 'Archive'} onClick={() => toggleArchiveProject(project.id)}>
            {project.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
          </button>
          <button type="button" aria-label="Delete" onClick={handleDelete}><Trash2 size={14} /></button>
        </div>
      </div>

      {expanded && hasChildren && (
        <div>
          {children.map((child) => (
            <ProjectTreeItem key={child.id} project={child} allProjects={allProjects} depth={depth + 1} />
          ))}
        </div>
      )}

      {editing && (
        <ProjectFormModal
          title="Rename project"
          initialName={project.name}
          initialColor={project.color}
          onClose={() => setEditing(false)}
          onSubmit={async (name, color) => {
            await updateProject(project.id, { name, color });
            setEditing(false);
          }}
        />
      )}

      {addingChild && (
        <ProjectFormModal
          title="New sub-project"
          onClose={() => setAddingChild(false)}
          onSubmit={async (name, color) => {
            await createProject(name, color, project.id);
            setAddingChild(false);
          }}
        />
      )}
    </div>
  );
}

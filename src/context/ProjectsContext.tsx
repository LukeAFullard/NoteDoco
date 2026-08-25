import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Project } from '../types';
import { getProjects, putProject, deleteProject as dbDeleteProject, getNotesByProject, putNote } from '../db';

type DeleteResult = { ok: true } | { ok: false; reason: 'has-children' };

interface ProjectsContextValue {
  projects: Project[];
  loading: boolean;
  createProject: (name: string, color: Project['color'], parentId: string | null) => Promise<Project>;
  updateProject: (id: string, updates: { name: string; color: Project['color'] }) => Promise<void>;
  toggleArchiveProject: (id: string) => Promise<void>;
  deleteProject: (id: string) => Promise<DeleteResult>;
}

const ProjectsContext = createContext<ProjectsContextValue | null>(null);

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setProjects(await getProjects());
  }, []);

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, [reload]);

  const createProject = async (name: string, color: Project['color'], parentId: string | null) => {
    const now = new Date().toISOString();
    const project: Project = { id: crypto.randomUUID(), name, color, parentId, archived: false, createdAt: now, updatedAt: now };
    await putProject(project);
    await reload();
    return project;
  };

  const updateProject = async (id: string, updates: { name: string; color: Project['color'] }) => {
    const existing = projects.find((p) => p.id === id);
    if (!existing) return;
    await putProject({ ...existing, ...updates, updatedAt: new Date().toISOString() });
    await reload();
  };

  const toggleArchiveProject = async (id: string) => {
    const existing = projects.find((p) => p.id === id);
    if (!existing) return;
    await putProject({ ...existing, archived: !existing.archived, updatedAt: new Date().toISOString() });
    await reload();
  };

  const deleteProject = async (id: string): Promise<DeleteResult> => {
    const hasChildren = projects.some((p) => p.parentId === id);
    if (hasChildren) return { ok: false, reason: 'has-children' };

    const notes = await getNotesByProject(id);
    for (const note of notes) {
      await putNote({ ...note, projectId: null, updatedAt: new Date().toISOString() });
    }

    await dbDeleteProject(id);
    await reload();
    return { ok: true };
  };

  return (
    <ProjectsContext.Provider value={{ projects, loading, createProject, updateProject, toggleArchiveProject, deleteProject }}>
      {children}
    </ProjectsContext.Provider>
  );
}

export function useProjects() {
  const ctx = useContext(ProjectsContext);
  if (!ctx) throw new Error('useProjects must be used within a ProjectsProvider');
  return ctx;
}

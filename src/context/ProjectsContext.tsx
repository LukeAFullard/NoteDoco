import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import type { Project } from '../types';
import { getProjects, putProject, deleteProject } from '../db';

interface ProjectsContextType {
  projects: Project[];
  loading: boolean;
  createProject: (name: string, color: Project['color'], parentId: string | null) => Promise<string>;
  updateProject: (project: Project) => Promise<void>;
  removeProject: (id: string) => Promise<void>;
  refreshProjects: () => Promise<void>;
}

const ProjectsContext = createContext<ProjectsContextType | undefined>(undefined);

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshProjects = async () => {
    const list = await getProjects();
    setProjects(list);
    setLoading(false);
  };

  useEffect(() => {
    refreshProjects();
  }, []);

  const createProject = async (name: string, color: Project['color'], parentId: string | null = null) => {
    const now = new Date().toISOString();
    const newProj: Project = {
      id: crypto.randomUUID(),
      name,
      color,
      parentId,
      archived: false,
      createdAt: now,
      updatedAt: now,
    };
    await putProject(newProj);
    await refreshProjects();
    return newProj.id;
  };

  const updateProject = async (project: Project) => {
    await putProject({ ...project, updatedAt: new Date().toISOString() });
    await refreshProjects();
  };

  const removeProject = async (id: string) => {
    await deleteProject(id);
    await refreshProjects();
  };

  return (
    <ProjectsContext.Provider
      value={{ projects, loading, createProject, updateProject, removeProject, refreshProjects }}
    >
      {children}
    </ProjectsContext.Provider>
  );
}

export function useProjects() {
  const context = useContext(ProjectsContext);
  if (!context) {
    throw new Error('useProjects must be used within a ProjectsProvider');
  }
  return context;
}

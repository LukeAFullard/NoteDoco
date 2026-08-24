import type { Project } from '../../types';

export function ProjectTreeItem({ project }: { project: Project; allProjects: Project[]; depth: number }) {
  return <div data-testid={`project-item-${project.id}`}>{project.name}</div>;
}

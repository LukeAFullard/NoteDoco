import { useParams } from 'react-router-dom';

export function ProjectView() {
  const { projectId } = useParams<{ projectId?: string }>();
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold">{projectId ? `Project: ${projectId}` : 'Unfiled Notes'}</h1>
    </div>
  );
}

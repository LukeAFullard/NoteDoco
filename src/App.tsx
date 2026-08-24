import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ProjectsProvider } from './context/ProjectsContext';
import { AppShell } from './components/layout/AppShell';
import { Dashboard } from './pages/Dashboard';
import { ProjectView } from './pages/ProjectView';
import { NoteEditor } from './pages/NoteEditor';
import { Timeline } from './pages/Timeline';

function App() {
  return (
    <ProjectsProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/unfiled" element={<ProjectView />} />
            <Route path="/projects/:projectId" element={<ProjectView />} />
            <Route path="/notes/:noteId" element={<NoteEditor />} />
            <Route path="/timeline" element={<Timeline />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ProjectsProvider>
  );
}

export default App;

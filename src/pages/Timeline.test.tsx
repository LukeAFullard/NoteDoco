import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import 'fake-indexeddb/auto';
import { Timeline } from './Timeline';
import { ProjectsProvider } from '../context/ProjectsContext';
import { closeDB, putNote } from '../db';
import type { Note } from '../types';

beforeEach(async () => {
  await closeDB();
  indexedDB = new IDBFactory();
});

describe('Timeline', () => {
  it('shows the empty state when no notes have a goal date', async () => {
    render(
      <MemoryRouter>
        <ProjectsProvider>
          <Timeline />
        </ProjectsProvider>
      </MemoryRouter>
    );
    expect(await screen.findByText(/Nothing to show/)).toBeInTheDocument();
  });

  it('shows an unfiled note with a goal date as a pill', async () => {
    const now = new Date().toISOString();
    const note: Note = {
      id: crypto.randomUUID(),
      projectId: null,
      title: 'Ship the roadmap',
      contentMarkdown: '',
      goalDate: now.slice(0, 10),
      archived: false,
      createdAt: now,
      updatedAt: now,
    };
    await putNote(note);

    render(
      <MemoryRouter>
        <ProjectsProvider>
          <Timeline />
        </ProjectsProvider>
      </MemoryRouter>
    );

    expect(await screen.findByText('Ship the roadmap')).toBeInTheDocument();
    expect(screen.getByText('Unfiled')).toBeInTheDocument();
  });
});

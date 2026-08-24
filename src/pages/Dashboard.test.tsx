import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { addDays, format } from 'date-fns';
import 'fake-indexeddb/auto';
import { Dashboard } from './Dashboard';
import { ProjectsProvider } from '../context/ProjectsContext';
import { closeDB, putNote } from '../db';
import type { Note } from '../types';

beforeEach(async () => {
  await closeDB();
  indexedDB = new IDBFactory();
});

const makeNote = (goalDate: string | null, overrides: Partial<Note> = {}): Note => {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    projectId: null,
    title: 'Test note',
    contentMarkdown: '',
    goalDate,
    archived: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
};

describe('Dashboard', () => {
  it('shows the empty state when no notes have a goal date', async () => {
    render(
      <MemoryRouter>
        <ProjectsProvider>
          <Dashboard />
        </ProjectsProvider>
      </MemoryRouter>
    );
    expect(await screen.findByText(/Nothing due/)).toBeInTheDocument();
  });

  it('buckets an overdue note correctly', async () => {
    const yesterday = format(addDays(new Date(), -1), 'yyyy-MM-dd');
    await putNote(makeNote(yesterday, { title: 'Overdue task' }));

    render(
      <MemoryRouter>
        <ProjectsProvider>
          <Dashboard />
        </ProjectsProvider>
      </MemoryRouter>
    );

    expect(await screen.findByText('Overdue')).toBeInTheDocument();
    expect(screen.getByText('Overdue task')).toBeInTheDocument();
  });
});

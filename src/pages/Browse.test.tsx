import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import 'fake-indexeddb/auto';
import { Browse } from './Browse';
import { ProjectsProvider } from '../context/ProjectsContext';
import { closeDB, putNote } from '../db';
import type { Note } from '../types';

beforeEach(async () => {
  await closeDB();
  indexedDB = new IDBFactory();
});

afterEach(() => {
  cleanup();
});

const makeNote = (overrides: Partial<Note> = {}): Note => {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    projectId: null,
    title: 'Untitled',
    contentMarkdown: '',
    goalDate: null,
    archived: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
};

const renderBrowse = () =>
  render(
    <MemoryRouter>
      <ProjectsProvider>
        <Browse />
      </ProjectsProvider>
    </MemoryRouter>
  );

describe('Browse', () => {
  it('shows the tag cloud when the query is empty', async () => {
    await putNote(makeNote({ title: 'Recipe', contentMarkdown: '#cooking' }));
    renderBrowse();
    expect(await screen.findByText('cooking')).toBeInTheDocument();
  });

  it('filters notes by a plain text query', async () => {
    await putNote(makeNote({ title: 'Grocery list', contentMarkdown: 'milk and eggs' }));
    await putNote(makeNote({ title: 'Trip plan', contentMarkdown: 'flights and hotels' }));
    renderBrowse();

    fireEvent.change(await screen.findByPlaceholderText(/search notes/i), { target: { value: 'grocery' } });
    expect(await screen.findByText('Grocery list')).toBeInTheDocument();
    expect(screen.queryByText('Trip plan')).not.toBeInTheDocument();
  });

  it('clicking a tag fills the search box and filters to that tag', async () => {
    await putNote(makeNote({ title: 'Tagged note', contentMarkdown: '#urgent do this' }));
    await putNote(makeNote({ title: 'Other note', contentMarkdown: 'nothing tagged here' }));
    renderBrowse();

    fireEvent.click(await screen.findByText('urgent'));
    expect(await screen.findByText('Tagged note')).toBeInTheDocument();
    expect(screen.queryByText('Other note')).not.toBeInTheDocument();
  });
});

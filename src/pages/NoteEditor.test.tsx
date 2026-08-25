import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import 'fake-indexeddb/auto';
import { NoteEditor } from './NoteEditor';
import { closeDB, putNote } from '../db';
import type { Note } from '../types';

beforeEach(async () => {
  await closeDB();
  indexedDB = new IDBFactory();
});

const seedNote = async (): Promise<Note> => {
  const now = new Date().toISOString();
  const note: Note = {
    id: 'note-1',
    projectId: null,
    title: 'Focus test note',
    contentMarkdown: 'Some content',
    goalDate: null,
    archived: false,
    createdAt: now,
    updatedAt: now,
  };
  await putNote(note);
  return note;
};

const renderEditor = () =>
  render(
    <MemoryRouter initialEntries={['/notes/note-1']}>
      <Routes>
        <Route path="/notes/:noteId" element={<NoteEditor />} />
      </Routes>
    </MemoryRouter>
  );

describe('NoteEditor focus mode', () => {
  it('enters and exits focus mode via the toggle button', async () => {
    await seedNote();
    renderEditor();

    expect(await screen.findByText('Back')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Enter focus mode'));
    expect(screen.queryByText('Back')).not.toBeInTheDocument();
    expect(screen.getByText('Focus mode')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Exit focus mode'));
    expect(await screen.findByText('Back')).toBeInTheDocument();
  });

  it('exits focus mode when Escape is pressed', async () => {
    await seedNote();
    renderEditor();

    expect(await screen.findByText('Back')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Enter focus mode'));
    expect(screen.getByText('Focus mode')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.getByText('Back')).toBeInTheDocument();
    });
  });
});

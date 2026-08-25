import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import 'fake-indexeddb/auto';
import { NoteEditor } from './NoteEditor';
import { closeDB, putNote, getNoteVersions, putNoteVersion } from '../db';
import type { Note, NoteVersion } from '../types';

beforeEach(async () => {
  await closeDB();
  indexedDB = new IDBFactory();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const seedNote = async (id = 'note-1', overrides: Partial<Note> = {}): Promise<Note> => {
  const now = new Date().toISOString();
  const note: Note = {
    id,
    projectId: null,
    title: 'Focus test note',
    contentMarkdown: 'Some content',
    goalDate: null,
    archived: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
  await putNote(note);
  return note;
};

const renderEditor = (noteId = 'note-1') =>
  render(
    <MemoryRouter initialEntries={[`/notes/${noteId}`]}>
      <Routes>
        <Route path="/notes/:noteId" element={<NoteEditor />} />
      </Routes>
    </MemoryRouter>
  );

describe('NoteEditor focus mode', () => {
  it('enters and exits focus mode via the toggle button', async () => {
    await seedNote('note-focus-1');
    renderEditor('note-focus-1');

    expect(await screen.findByText('Back')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Enter focus mode'));
    expect(screen.queryByText('Back')).not.toBeInTheDocument();
    expect(screen.getByText('Focus mode')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Exit focus mode'));
    expect(await screen.findByText('Back')).toBeInTheDocument();
  });

  it('exits focus mode when Escape is pressed', async () => {
    await seedNote('note-focus-2');
    renderEditor('note-focus-2');

    expect(await screen.findByText('Back')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Enter focus mode'));
    expect(screen.getByText('Focus mode')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.getByText('Back')).toBeInTheDocument();
    });
  });
});

describe('NoteEditor time-travel history', () => {
  it('creates a baseline checkpoint on first load if no history exists', async () => {
    const note = await seedNote('note-hist-1');
    renderEditor('note-hist-1');

    await waitFor(async () => {
      const versions = await getNoteVersions(note.id);
      expect(versions).toHaveLength(1);
      expect(versions[0].title).toBe(note.title);
      expect(versions[0].contentMarkdown).toBe(note.contentMarkdown);
    });
  });

  it('opens history modal and displays history checkpoints', async () => {
    const note = await seedNote('note-hist-2');
    const version1: NoteVersion = {
      id: 'v-1',
      noteId: note.id,
      title: 'Old Title',
      contentMarkdown: 'Old content',
      goalDate: null,
      savedAt: '2026-01-01T10:00:00.000Z',
    };
    await putNoteVersion(version1);

    renderEditor('note-hist-2');

    const historyBtn = await screen.findByLabelText('History');
    fireEvent.click(historyBtn);

    expect(await screen.findByText('History')).toBeInTheDocument();
    expect(await screen.findByText('Old Title')).toBeInTheDocument();
  });

  it('restores a version after saving current state as a checkpoint', async () => {
    const note = await seedNote('note-hist-3', { title: 'Current Title', contentMarkdown: 'Current Content' });
    const version1: NoteVersion = {
      id: 'v-1',
      noteId: note.id,
      title: 'Restored Title',
      contentMarkdown: 'Restored content',
      goalDate: null,
      savedAt: '2026-01-01T10:00:00.000Z',
    };
    await putNoteVersion(version1);

    vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderEditor('note-hist-3');

    const historyBtn = await screen.findByLabelText('History');
    fireEvent.click(historyBtn);

    const restoreBtn = await screen.findByRole('button', { name: 'Restore' });
    fireEvent.click(restoreBtn);

    await waitFor(async () => {
      const versions = await getNoteVersions(note.id);
      expect(versions.length).toBeGreaterThanOrEqual(2);
      expect((screen.getByPlaceholderText('Untitled note') as HTMLInputElement).value).toBe('Restored Title');
    });
  });
});

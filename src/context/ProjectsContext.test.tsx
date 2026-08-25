import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { ProjectsProvider, useProjects } from './ProjectsContext';
import { closeDB, putNote, getNote } from '../db';
import type { Note } from '../types';

beforeEach(async () => {
  await closeDB();
  indexedDB = new IDBFactory();
});

describe('useProjects', () => {
  it('creates, updates, and deletes a project', async () => {
    const { result } = renderHook(() => useProjects(), { wrapper: ProjectsProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let created: Awaited<ReturnType<typeof result.current.createProject>> = null!;
    await act(async () => {
      created = await result.current.createProject('Client A', 'signal', null);
    });
    expect(result.current.projects).toHaveLength(1);

    await act(async () => {
      await result.current.updateProject(created.id, { name: 'Client A Renamed', color: 'verdigris' });
    });
    expect(result.current.projects[0].name).toBe('Client A Renamed');

    await act(async () => {
      const outcome = await result.current.deleteProject(created.id);
      expect(outcome.ok).toBe(true);
    });
    expect(result.current.projects).toHaveLength(0);
  });

  it('blocks deletion of a project with sub-projects', async () => {
    const { result } = renderHook(() => useProjects(), { wrapper: ProjectsProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let parent: Awaited<ReturnType<typeof result.current.createProject>> = null!;
    await act(async () => {
      parent = await result.current.createProject('Parent', 'signal', null);
    });
    await act(async () => {
      await result.current.createProject('Child', 'signal', parent.id);
    });

    await act(async () => {
      const outcome = await result.current.deleteProject(parent.id);
      expect(outcome).toEqual({ ok: false, reason: 'has-children' });
    });
  });

  it('reassigns notes to unfiled when their project is deleted', async () => {
    const { result } = renderHook(() => useProjects(), { wrapper: ProjectsProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let project: Awaited<ReturnType<typeof result.current.createProject>> = null!;
    await act(async () => {
      project = await result.current.createProject('Temp', 'signal', null);
    });

    const now = new Date().toISOString();
    const note: Note = {
      id: crypto.randomUUID(),
      projectId: project.id,
      title: 'Orphan-to-be',
      contentMarkdown: '',
      goalDate: null,
      archived: false,
      createdAt: now,
      updatedAt: now,
    };
    await putNote(note);

    await act(async () => {
      await result.current.deleteProject(project.id);
    });

    const reloaded = await getNote(note.id);
    expect(reloaded?.projectId).toBeNull();
  });
});

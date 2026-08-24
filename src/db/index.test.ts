import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import {
  closeDB,
  putProject,
  getProject,
  getProjects,
  deleteProject,
  putNote,
  getNote,
  getNotesByProject,
  deleteNote,
} from './index';
import type { Project, Note } from '../types';

const now = new Date().toISOString();

const makeProject = (overrides: Partial<Project> = {}): Project => ({
  id: crypto.randomUUID(),
  name: 'Test Project',
  color: 'signal',
  parentId: null,
  archived: false,
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

const makeNote = (projectId: string | null, overrides: Partial<Note> = {}): Note => ({
  id: crypto.randomUUID(),
  projectId,
  title: 'Test Note',
  contentMarkdown: '- [ ] first item\n- [x] second item',
  goalDate: null,
  archived: false,
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

beforeEach(async () => {
  await closeDB();
  indexedDB = new IDBFactory();
});

describe('projects', () => {
  it('puts and gets a project', async () => {
    const project = makeProject();
    await putProject(project);
    const fetched = await getProject(project.id);
    expect(fetched).toEqual(project);
  });

  it('lists all projects', async () => {
    await putProject(makeProject({ name: 'A' }));
    await putProject(makeProject({ name: 'B' }));
    const all = await getProjects();
    expect(all).toHaveLength(2);
  });

  it('deletes a project', async () => {
    const project = makeProject();
    await putProject(project);
    await deleteProject(project.id);
    expect(await getProject(project.id)).toBeUndefined();
  });
});

describe('notes', () => {
  it('puts and gets a note', async () => {
    const note = makeNote(null);
    await putNote(note);
    const fetched = await getNote(note.id);
    expect(fetched).toEqual(note);
  });

  it('queries notes by project via the by-project index', async () => {
    const project = makeProject();
    await putProject(project);
    await putNote(makeNote(project.id, { title: 'In project' }));
    await putNote(makeNote(null, { title: 'Unfiled' }));

    const results = await getNotesByProject(project.id);
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('In project');
  });

  it('deletes a note', async () => {
    const note = makeNote(null);
    await putNote(note);
    await deleteNote(note.id);
    expect(await getNote(note.id)).toBeUndefined();
  });
});

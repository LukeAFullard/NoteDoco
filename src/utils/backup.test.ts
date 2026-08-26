import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { closeDB, putProject, putNote, getProject, getNote } from '../db';
import { buildBackup, parseBackupFile, importBackup } from './backup';
import type { Project, Note } from '../types';

beforeEach(async () => {
  await closeDB();
  indexedDB = new IDBFactory();
});

const makeProject = (overrides: Partial<Project> = {}): Project => {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), name: 'P', color: 'signal', parentId: null, archived: false, createdAt: now, updatedAt: now, ...overrides };
};

const makeNote = (projectId: string | null, overrides: Partial<Note> = {}): Note => {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), projectId, title: 'N', contentMarkdown: '', goalDate: null, archived: false, createdAt: now, updatedAt: now, ...overrides };
};

describe('buildBackup', () => {
  it('bundles all projects and notes with a version number', async () => {
    const project = makeProject();
    await putProject(project);
    await putNote(makeNote(project.id));

    const backup = await buildBackup();
    expect(backup.version).toBe(1);
    expect(backup.projects).toHaveLength(1);
    expect(backup.notes).toHaveLength(1);
  });
});

describe('parseBackupFile', () => {
  it('parses a valid backup file', () => {
    const json = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), projects: [], notes: [], noteVersions: [] });
    expect(() => parseBackupFile(json)).not.toThrow();
  });

  it('rejects an unrecognised version', () => {
    const json = JSON.stringify({ version: 99, projects: [], notes: [] });
    expect(() => parseBackupFile(json)).toThrow(/version/i);
  });

  it('rejects a file that is not a NoteDoco backup', () => {
    expect(() => parseBackupFile(JSON.stringify({ hello: 'world' }))).toThrow();
  });

  it('rejects invalid JSON', () => {
    expect(() => parseBackupFile('not json')).toThrow();
  });
});

describe('importBackup', () => {
  it('upserts projects and notes from the backup data', async () => {
    const project = makeProject({ name: 'Imported Project' });
    const note = makeNote(project.id, { title: 'Imported Note' });
    const result = await importBackup({ version: 1, exportedAt: new Date().toISOString(), projects: [project], notes: [note], noteVersions: [] });

    expect(result).toEqual({ projectsImported: 1, notesImported: 1, versionsImported: 0 });
    expect((await getProject(project.id))?.name).toBe('Imported Project');
    expect((await getNote(note.id))?.title).toBe('Imported Note');
  });
});

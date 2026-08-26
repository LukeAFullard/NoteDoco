import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { closeDB, putProject, putNote, putAttachment, getProject, getNote, getAttachmentsByNote } from '../db';
import { buildBackup, parseBackupFile, importBackup } from './backup';
import type { Project, Note, Attachment } from '../types';

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
  it('bundles all projects, notes, and attachments with version 2', async () => {
    const project = makeProject();
    await putProject(project);
    const note = makeNote(project.id);
    await putNote(note);
    const attachment: Attachment = {
      id: 'att-1',
      noteId: note.id,
      filename: 'file.txt',
      mimeType: 'text/plain',
      size: 12,
      blob: new Blob(['file content'], { type: 'text/plain' }),
      createdAt: new Date().toISOString(),
    };
    await putAttachment(attachment);

    const { data, attachments } = await buildBackup();
    expect(data.version).toBe(2);
    expect(data.projects).toHaveLength(1);
    expect(data.notes).toHaveLength(1);
    expect(data.attachments).toHaveLength(1);
    expect(data.attachments?.[0].id).toBe('att-1');
    expect(attachments).toHaveLength(1);
  });
});

describe('parseBackupFile', () => {
  it('parses a valid backup file (v1 or v2)', () => {
    const jsonV1 = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), projects: [], notes: [], noteVersions: [] });
    const parsedV1 = parseBackupFile(jsonV1);
    expect(parsedV1.version).toBe(1);
    expect(parsedV1.attachments).toEqual([]);

    const jsonV2 = JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), projects: [], notes: [], noteVersions: [], attachments: [] });
    const parsedV2 = parseBackupFile(jsonV2);
    expect(parsedV2.version).toBe(2);
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

    expect(result).toEqual({ projectsImported: 1, notesImported: 1, versionsImported: 0, attachmentsImported: 0 });
    expect((await getProject(project.id))?.name).toBe('Imported Project');
    expect((await getNote(note.id))?.title).toBe('Imported Note');
  });

  it('imports attachments if provided', async () => {
    const note = makeNote(null);
    await putNote(note);
    const attachment: Attachment = {
      id: 'att-1',
      noteId: note.id,
      filename: 'img.png',
      mimeType: 'image/png',
      size: 10,
      blob: new Blob(['png content'], { type: 'image/png' }),
      createdAt: new Date().toISOString(),
    };

    const result = await importBackup(
      { version: 2, exportedAt: new Date().toISOString(), projects: [], notes: [note], noteVersions: [] },
      [attachment]
    );

    expect(result.attachmentsImported).toBe(1);
    const saved = await getAttachmentsByNote(note.id);
    expect(saved).toHaveLength(1);
    expect(saved[0].filename).toBe('img.png');
  });
});

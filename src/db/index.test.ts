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
  putNoteVersion,
  getNoteVersions,
  getSettings,
  putSettings,
  putAttachment,
  getAttachmentsByNote,
  deleteAttachment,
  getAllAttachments,
} from './index';
import type { Project, Note, NoteVersion, Attachment } from '../types';

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

const makeVersion = (noteId: string, overrides: Partial<NoteVersion> = {}): NoteVersion => ({
  id: crypto.randomUUID(),
  noteId,
  title: 'Test Note',
  contentMarkdown: 'snapshot content',
  goalDate: null,
  savedAt: now,
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
    expect(await getProject(project.id)).toEqual(project);
  });

  it('lists all projects', async () => {
    await putProject(makeProject({ name: 'A' }));
    await putProject(makeProject({ name: 'B' }));
    expect(await getProjects()).toHaveLength(2);
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
    expect(await getNote(note.id)).toEqual(note);
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

describe('note versions', () => {
  it('puts a version and queries it by noteId', async () => {
    const note = makeNote(null);
    await putNote(note);
    await putNoteVersion(makeVersion(note.id, { title: 'v1' }));
    await putNoteVersion(makeVersion(note.id, { title: 'v2' }));
    await putNoteVersion(makeVersion('some-other-note-id', { title: 'unrelated' }));

    const versions = await getNoteVersions(note.id);
    expect(versions).toHaveLength(2);
    expect(versions.map((v) => v.title).sort()).toEqual(['v1', 'v2']);
  });

  it('returns an empty array for a note with no history', async () => {
    expect(await getNoteVersions('nonexistent')).toEqual([]);
  });
});

describe('settings', () => {
  it('returns default settings when none exist yet', async () => {
    expect(await getSettings()).toEqual({ id: 'app-settings', lastBackupDate: null, reminderIntervalDays: 14, notificationsEnabled: false });
  });

  it('puts and retrieves updated settings', async () => {
    await putSettings({ id: 'app-settings', lastBackupDate: '2026-01-01T00:00:00.000Z', reminderIntervalDays: 30, notificationsEnabled: true });
    const settings = await getSettings();
    expect(settings.lastBackupDate).toBe('2026-01-01T00:00:00.000Z');
    expect(settings.reminderIntervalDays).toBe(30);
    expect(settings.notificationsEnabled).toBe(true);
  });
});

describe('attachments', () => {
  const makeAttachment = (noteId: string, overrides: Partial<Attachment> = {}): Attachment => ({
    id: crypto.randomUUID(),
    noteId,
    filename: 'test.png',
    mimeType: 'image/png',
    size: 1024,
    blob: new Blob(['test content'], { type: 'image/png' }),
    createdAt: now,
    ...overrides,
  });

  it('puts and gets attachments by noteId index', async () => {
    const noteId1 = crypto.randomUUID();
    const noteId2 = crypto.randomUUID();

    const att1 = makeAttachment(noteId1, { filename: 'file1.txt' });
    const att2 = makeAttachment(noteId1, { filename: 'file2.txt' });
    const att3 = makeAttachment(noteId2, { filename: 'file3.txt' });

    await putAttachment(att1);
    await putAttachment(att2);
    await putAttachment(att3);

    const note1Atts = await getAttachmentsByNote(noteId1);
    expect(note1Atts).toHaveLength(2);
    expect(note1Atts.map((a) => a.filename).sort()).toEqual(['file1.txt', 'file2.txt']);

    const note2Atts = await getAttachmentsByNote(noteId2);
    expect(note2Atts).toHaveLength(1);
    expect(note2Atts[0].filename).toBe('file3.txt');
  });

  it('getAllAttachments returns all attachments across notes', async () => {
    const noteId1 = crypto.randomUUID();
    const noteId2 = crypto.randomUUID();

    await putAttachment(makeAttachment(noteId1));
    await putAttachment(makeAttachment(noteId2));

    const all = await getAllAttachments();
    expect(all).toHaveLength(2);
  });

  it('deletes an attachment', async () => {
    const noteId = crypto.randomUUID();
    const att = makeAttachment(noteId);
    await putAttachment(att);

    await deleteAttachment(att.id);
    expect(await getAttachmentsByNote(noteId)).toHaveLength(0);
  });
});

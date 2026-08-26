import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Project, Note, NoteVersion, AppSettings, Attachment } from '../types';

interface NoteDocoDB extends DBSchema {
  projects: {
    key: string;
    value: Project;
    indexes: { 'by-parent': string };
  };
  notes: {
    key: string;
    value: Note;
    indexes: { 'by-project': string; 'by-goalDate': string };
  };
  noteVersions: {
    key: string;
    value: NoteVersion;
    indexes: { 'by-note': string };
  };
  settings: {
    key: string;
    value: AppSettings;
  };
  attachments: {
    key: string;
    value: Attachment;
    indexes: { 'by-note': string };
  };
}

const DB_NAME = 'note-doco-db';
const DB_VERSION = 4;

const DEFAULT_SETTINGS: AppSettings = {
  id: 'app-settings',
  lastBackupDate: null,
  reminderIntervalDays: 14,
};

let dbPromise: Promise<IDBPDatabase<NoteDocoDB>> | null = null;
let isFallbackMode = false;

const fallbackMemoryDB = {
  projects: new Map<string, Project>(),
  notes: new Map<string, Note>(),
  noteVersions: new Map<string, NoteVersion>(),
  settings: new Map<string, AppSettings>(),
  attachments: new Map<string, Attachment>(),
};

const triggerFallbackMode = (error: unknown) => {
  if (!isFallbackMode) {
    console.error('IndexedDB failed, entering in-memory fallback mode:', error);
    isFallbackMode = true;
    window.dispatchEvent(new CustomEvent('idb-fallback-mode', { detail: { error } }));
  }
};

export const closeDB = async () => {
  if (dbPromise) {
    const db = await dbPromise;
    db.close();
    dbPromise = null;
  }
  isFallbackMode = false;
  fallbackMemoryDB.projects.clear();
  fallbackMemoryDB.notes.clear();
  fallbackMemoryDB.noteVersions.clear();
  fallbackMemoryDB.settings.clear();
  fallbackMemoryDB.attachments.clear();
};

export const initDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<NoteDocoDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('projects')) {
          const projectStore = db.createObjectStore('projects', { keyPath: 'id' });
          projectStore.createIndex('by-parent', 'parentId');
        }
        if (!db.objectStoreNames.contains('notes')) {
          const noteStore = db.createObjectStore('notes', { keyPath: 'id' });
          noteStore.createIndex('by-project', 'projectId');
          noteStore.createIndex('by-goalDate', 'goalDate');
        }
        if (!db.objectStoreNames.contains('noteVersions')) {
          const versionStore = db.createObjectStore('noteVersions', { keyPath: 'id' });
          versionStore.createIndex('by-note', 'noteId');
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('attachments')) {
          const attachmentStore = db.createObjectStore('attachments', { keyPath: 'id' });
          attachmentStore.createIndex('by-note', 'noteId');
        }
      },
    });
  }
  return dbPromise;
};

export const getDB = async () => {
  try {
    return await initDB();
  } catch (error) {
    triggerFallbackMode(error);
    throw error;
  }
};

// --- Projects ---

export const getProjects = async (): Promise<Project[]> => {
  if (isFallbackMode) return Array.from(fallbackMemoryDB.projects.values());
  try {
    const db = await getDB();
    return await db.getAll('projects');
  } catch (error) {
    triggerFallbackMode(error);
    return Array.from(fallbackMemoryDB.projects.values());
  }
};

export const getProject = async (id: string): Promise<Project | undefined> => {
  if (isFallbackMode) return fallbackMemoryDB.projects.get(id);
  try {
    const db = await getDB();
    return await db.get('projects', id);
  } catch (error) {
    triggerFallbackMode(error);
    return fallbackMemoryDB.projects.get(id);
  }
};

export const putProject = async (project: Project): Promise<string> => {
  if (isFallbackMode) {
    fallbackMemoryDB.projects.set(project.id, project);
    return project.id;
  }
  try {
    const db = await getDB();
    await db.put('projects', project);
    return project.id;
  } catch (error) {
    triggerFallbackMode(error);
    fallbackMemoryDB.projects.set(project.id, project);
    return project.id;
  }
};

export const deleteProject = async (id: string): Promise<void> => {
  if (isFallbackMode) {
    fallbackMemoryDB.projects.delete(id);
    return;
  }
  try {
    const db = await getDB();
    await db.delete('projects', id);
  } catch (error) {
    triggerFallbackMode(error);
    fallbackMemoryDB.projects.delete(id);
  }
};

// --- Notes ---

export const getNotes = async (): Promise<Note[]> => {
  if (isFallbackMode) return Array.from(fallbackMemoryDB.notes.values());
  try {
    const db = await getDB();
    return await db.getAll('notes');
  } catch (error) {
    triggerFallbackMode(error);
    return Array.from(fallbackMemoryDB.notes.values());
  }
};

export const getNotesByProject = async (projectId: string): Promise<Note[]> => {
  if (isFallbackMode) {
    return Array.from(fallbackMemoryDB.notes.values()).filter((n) => n.projectId === projectId);
  }
  try {
    const db = await getDB();
    return await db.getAllFromIndex('notes', 'by-project', projectId);
  } catch (error) {
    triggerFallbackMode(error);
    return Array.from(fallbackMemoryDB.notes.values()).filter((n) => n.projectId === projectId);
  }
};

export const getNote = async (id: string): Promise<Note | undefined> => {
  if (isFallbackMode) return fallbackMemoryDB.notes.get(id);
  try {
    const db = await getDB();
    return await db.get('notes', id);
  } catch (error) {
    triggerFallbackMode(error);
    return fallbackMemoryDB.notes.get(id);
  }
};

export const putNote = async (note: Note): Promise<string> => {
  if (isFallbackMode) {
    fallbackMemoryDB.notes.set(note.id, note);
    return note.id;
  }
  try {
    const db = await getDB();
    await db.put('notes', note);
    return note.id;
  } catch (error) {
    triggerFallbackMode(error);
    fallbackMemoryDB.notes.set(note.id, note);
    return note.id;
  }
};

export const deleteNote = async (id: string): Promise<void> => {
  if (isFallbackMode) {
    fallbackMemoryDB.notes.delete(id);
    return;
  }
  try {
    const db = await getDB();
    await db.delete('notes', id);
  } catch (error) {
    triggerFallbackMode(error);
    fallbackMemoryDB.notes.delete(id);
  }
};

// --- Note Versions ---

export const getNoteVersions = async (noteId: string): Promise<NoteVersion[]> => {
  if (isFallbackMode) {
    return Array.from(fallbackMemoryDB.noteVersions.values()).filter((v) => v.noteId === noteId);
  }
  try {
    const db = await getDB();
    return await db.getAllFromIndex('noteVersions', 'by-note', noteId);
  } catch (error) {
    triggerFallbackMode(error);
    return Array.from(fallbackMemoryDB.noteVersions.values()).filter((v) => v.noteId === noteId);
  }
};

export const putNoteVersion = async (version: NoteVersion): Promise<string> => {
  if (isFallbackMode) {
    fallbackMemoryDB.noteVersions.set(version.id, version);
    return version.id;
  }
  try {
    const db = await getDB();
    await db.put('noteVersions', version);
    return version.id;
  } catch (error) {
    triggerFallbackMode(error);
    fallbackMemoryDB.noteVersions.set(version.id, version);
    return version.id;
  }
};

// --- Settings ---

export const getSettings = async (): Promise<AppSettings> => {
  if (isFallbackMode) return fallbackMemoryDB.settings.get('app-settings') ?? DEFAULT_SETTINGS;
  try {
    const db = await getDB();
    const existing = await db.get('settings', 'app-settings');
    return existing ?? DEFAULT_SETTINGS;
  } catch (error) {
    triggerFallbackMode(error);
    return fallbackMemoryDB.settings.get('app-settings') ?? DEFAULT_SETTINGS;
  }
};

export const putSettings = async (settings: AppSettings): Promise<string> => {
  if (isFallbackMode) {
    fallbackMemoryDB.settings.set(settings.id, settings);
    return settings.id;
  }
  try {
    const db = await getDB();
    await db.put('settings', settings);
    return settings.id;
  } catch (error) {
    triggerFallbackMode(error);
    fallbackMemoryDB.settings.set(settings.id, settings);
    return settings.id;
  }
};

// --- Attachments ---

export const getAttachmentsByNote = async (noteId: string): Promise<Attachment[]> => {
  if (isFallbackMode) {
    return Array.from(fallbackMemoryDB.attachments.values()).filter((a) => a.noteId === noteId);
  }
  try {
    const db = await getDB();
    return await db.getAllFromIndex('attachments', 'by-note', noteId);
  } catch (error) {
    triggerFallbackMode(error);
    return Array.from(fallbackMemoryDB.attachments.values()).filter((a) => a.noteId === noteId);
  }
};

export const putAttachment = async (attachment: Attachment): Promise<string> => {
  if (isFallbackMode) {
    fallbackMemoryDB.attachments.set(attachment.id, attachment);
    return attachment.id;
  }
  try {
    const db = await getDB();
    await db.put('attachments', attachment);
    return attachment.id;
  } catch (error) {
    triggerFallbackMode(error);
    fallbackMemoryDB.attachments.set(attachment.id, attachment);
    return attachment.id;
  }
};

export const deleteAttachment = async (id: string): Promise<void> => {
  if (isFallbackMode) {
    fallbackMemoryDB.attachments.delete(id);
    return;
  }
  try {
    const db = await getDB();
    await db.delete('attachments', id);
  } catch (error) {
    triggerFallbackMode(error);
    fallbackMemoryDB.attachments.delete(id);
  }
};

export const getAllAttachments = async (): Promise<Attachment[]> => {
  if (isFallbackMode) return Array.from(fallbackMemoryDB.attachments.values());
  try {
    const db = await getDB();
    return await db.getAll('attachments');
  } catch (error) {
    triggerFallbackMode(error);
    return Array.from(fallbackMemoryDB.attachments.values());
  }
};

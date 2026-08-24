import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Project, Note } from '../types';

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
}

const DB_NAME = 'note-doco-db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<NoteDocoDB>> | null = null;
let isFallbackMode = false;

const fallbackMemoryDB = {
  projects: new Map<string, Project>(),
  notes: new Map<string, Note>(),
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

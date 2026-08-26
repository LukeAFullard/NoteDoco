export interface Project {
  id: string;
  name: string;
  color: 'signal' | 'verdigris' | 'rust' | 'graphite';
  parentId: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly';

export interface Note {
  id: string;
  projectId: string | null;
  title: string;
  contentMarkdown: string;
  goalDate: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  recurrence?: Recurrence;
  lastRecurredAt?: string | null;
}

export interface NoteVersion {
  id: string;
  noteId: string;
  title: string;
  contentMarkdown: string;
  goalDate: string | null;
  savedAt: string;
}

export interface AppSettings {
  id: 'app-settings';
  lastBackupDate: string | null;
  reminderIntervalDays: number;
}

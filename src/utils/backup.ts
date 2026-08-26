import { getProjects, getNotes, getNoteVersions, putProject, putNote, putNoteVersion, getSettings, putSettings } from '../db';
import type { Project, Note, NoteVersion } from '../types';

export interface BackupData {
  version: 1;
  exportedAt: string;
  projects: Project[];
  notes: Note[];
  noteVersions: NoteVersion[];
}

export interface ImportResult {
  projectsImported: number;
  notesImported: number;
  versionsImported: number;
}

export const buildBackup = async (): Promise<BackupData> => {
  const [projects, notes] = await Promise.all([getProjects(), getNotes()]);
  const versionLists = await Promise.all(notes.map((n) => getNoteVersions(n.id)));
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    projects,
    notes,
    noteVersions: versionLists.flat(),
  };
};

export const downloadBackup = async (): Promise<void> => {
  const backup = await buildBackup();
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `notedoco-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);

  const settings = await getSettings();
  await putSettings({ ...settings, lastBackupDate: new Date().toISOString() });
};

export const parseBackupFile = (text: string): BackupData => {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('This file is not valid JSON.');
  }
  const candidate = data as Partial<BackupData>;
  if (candidate.version !== 1) {
    throw new Error('Unsupported or missing backup file version.');
  }
  if (!Array.isArray(candidate.projects) || !Array.isArray(candidate.notes)) {
    throw new Error('This file does not look like a NoteDoco backup.');
  }
  return candidate as BackupData;
};

export const importBackup = async (data: BackupData): Promise<ImportResult> => {
  for (const project of data.projects) await putProject(project);
  for (const note of data.notes) await putNote(note);
  for (const version of data.noteVersions ?? []) await putNoteVersion(version);
  return {
    projectsImported: data.projects.length,
    notesImported: data.notes.length,
    versionsImported: (data.noteVersions ?? []).length,
  };
};

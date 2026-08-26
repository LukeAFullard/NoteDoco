import { strToU8, strFromU8, zipSync, unzipSync } from 'fflate';
import {
  getProjects,
  getNotes,
  getNoteVersions,
  getAllAttachments,
  putProject,
  putNote,
  putNoteVersion,
  putAttachment,
  getSettings,
  putSettings,
} from '../db';
import type { Project, Note, NoteVersion, Attachment } from '../types';

export interface AttachmentMetadata {
  id: string;
  noteId: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export interface BackupData {
  version: 1 | 2;
  exportedAt: string;
  projects: Project[];
  notes: Note[];
  noteVersions: NoteVersion[];
  attachments?: AttachmentMetadata[];
}

export interface ImportResult {
  projectsImported: number;
  notesImported: number;
  versionsImported: number;
  attachmentsImported: number;
}

export const buildBackup = async (): Promise<{ data: BackupData; attachments: Attachment[] }> => {
  const [projects, notes, attachments] = await Promise.all([
    getProjects(),
    getNotes(),
    getAllAttachments(),
  ]);
  const versionLists = await Promise.all(notes.map((n) => getNoteVersions(n.id)));

  const attachmentMetadata: AttachmentMetadata[] = attachments.map((a) => ({
    id: a.id,
    noteId: a.noteId,
    filename: a.filename,
    mimeType: a.mimeType,
    size: a.size,
    createdAt: a.createdAt,
  }));

  return {
    data: {
      version: 2,
      exportedAt: new Date().toISOString(),
      projects,
      notes,
      noteVersions: versionLists.flat(),
      attachments: attachmentMetadata,
    },
    attachments,
  };
};

export const downloadBackup = async (options: { includeAttachments?: boolean } = {}): Promise<void> => {
  const { data, attachments } = await buildBackup();
  const dateStr = new Date().toISOString().slice(0, 10);

  if (options.includeAttachments) {
    const zipData: Record<string, Uint8Array> = {};
    zipData['data.json'] = strToU8(JSON.stringify(data, null, 2));

    for (const att of attachments) {
      const buffer = await att.blob.arrayBuffer();
      zipData[`attachments/${att.id}`] = new Uint8Array(buffer);
    }

    const zipped = zipSync(zipData);
    const blob = new Blob([zipped], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notedoco-backup-${dateStr}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  } else {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notedoco-backup-${dateStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

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
  if (candidate.version !== 1 && candidate.version !== 2) {
    throw new Error('Unsupported or missing backup file version.');
  }
  if (!Array.isArray(candidate.projects) || !Array.isArray(candidate.notes)) {
    throw new Error('This file does not look like a NoteDoco backup.');
  }
  return {
    ...candidate,
    version: candidate.version,
    exportedAt: candidate.exportedAt ?? new Date().toISOString(),
    projects: candidate.projects,
    notes: candidate.notes,
    noteVersions: candidate.noteVersions ?? [],
    attachments: Array.isArray(candidate.attachments) ? candidate.attachments : [],
  } as BackupData;
};

export const importBackup = async (
  data: BackupData,
  attachmentsWithBlobs: Attachment[] = []
): Promise<ImportResult> => {
  for (const project of data.projects) await putProject(project);
  for (const note of data.notes) await putNote(note);
  for (const version of data.noteVersions ?? []) await putNoteVersion(version);

  let attachmentsImported = 0;
  for (const att of attachmentsWithBlobs) {
    if (att.blob) {
      await putAttachment(att);
      attachmentsImported++;
    }
  }

  return {
    projectsImported: data.projects.length,
    notesImported: data.notes.length,
    versionsImported: (data.noteVersions ?? []).length,
    attachmentsImported,
  };
};

export const readAndImportBackupFile = async (file: File): Promise<ImportResult> => {
  const isZip =
    file.name.toLowerCase().endsWith('.zip') ||
    file.type === 'application/zip' ||
    file.type === 'application/x-zip-compressed';

  if (isZip) {
    let unzipped: Record<string, Uint8Array>;
    try {
      const buffer = await file.arrayBuffer();
      unzipped = unzipSync(new Uint8Array(buffer));
    } catch {
      throw new Error('Failed to extract zip file.');
    }

    const dataJsonBytes = unzipped['data.json'];
    if (!dataJsonBytes) {
      throw new Error('Invalid backup zip: missing data.json.');
    }

    const jsonText = strFromU8(dataJsonBytes);
    const backupData = parseBackupFile(jsonText);

    const attachmentsToImport: Attachment[] = [];
    for (const meta of backupData.attachments ?? []) {
      const fileBytes = unzipped[`attachments/${meta.id}`];
      if (fileBytes) {
        attachmentsToImport.push({
          ...meta,
          blob: new Blob([fileBytes as BlobPart], { type: meta.mimeType }),
        });
      }
    }

    return importBackup(backupData, attachmentsToImport);
  } else {
    const text = await file.text();
    const backupData = parseBackupFile(text);
    return importBackup(backupData, []);
  }
};

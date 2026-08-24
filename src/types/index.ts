export interface Project {
  id: string;
  name: string;
  color: 'signal' | 'verdigris' | 'rust' | 'graphite';
  parentId: string | null;
  archived: boolean;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface Note {
  id: string;
  projectId: string | null; // null = unfiled
  title: string;
  contentMarkdown: string; // plain markdown; checklist items use GFM "- [ ]" syntax
  goalDate: string | null; // ISO 8601 date only (e.g. "2026-09-01"), no time component
  archived: boolean;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

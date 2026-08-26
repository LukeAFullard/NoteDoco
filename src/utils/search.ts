import type { Note } from '../types';

const HASHTAG_PATTERN = /#([a-z0-9][a-z0-9-]*)/gi;

export const extractTags = (markdown: string): string[] => {
  const matches = markdown.matchAll(HASHTAG_PATTERN);
  const tags = new Set<string>();
  for (const match of matches) {
    tags.add(match[1].toLowerCase());
  }
  return Array.from(tags).sort();
};

export interface TagCount {
  tag: string;
  count: number;
}

export const getAllTags = (notes: Note[]): TagCount[] => {
  const counts = new Map<string, number>();
  notes.forEach((note) => {
    extractTags(note.contentMarkdown).forEach((tag) => {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    });
  });
  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
};

export const searchNotes = (notes: Note[], query: string): Note[] => {
  const trimmed = query.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('#')) {
    const tag = trimmed.slice(1).toLowerCase();
    if (!tag) return [];
    return notes.filter((note) => extractTags(note.contentMarkdown).includes(tag));
  }

  const needle = trimmed.toLowerCase();
  return notes.filter(
    (note) => note.title.toLowerCase().includes(needle) || note.contentMarkdown.toLowerCase().includes(needle)
  );
};

export const getMatchSnippet = (content: string, query: string, contextChars = 40): string => {
  const trimmed = query.trim();
  if (!trimmed || trimmed.startsWith('#')) return content.slice(0, contextChars * 2).trim();

  const needle = trimmed.toLowerCase();
  const index = content.toLowerCase().indexOf(needle);
  if (index === -1) return content.slice(0, contextChars * 2).trim();

  const start = Math.max(0, index - contextChars);
  const end = Math.min(content.length, index + needle.length + contextChars);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < content.length ? '…' : '';
  return `${prefix}${content.slice(start, end).trim()}${suffix}`;
};

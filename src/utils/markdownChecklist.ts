const CHECKLIST_LINE = /^(\s*)-\s\[( |x|X)\]\s(.*)$/;

export interface ChecklistLineInfo {
  indent: string;
  checked: boolean;
  text: string;
}

export const parseChecklistLine = (line: string): ChecklistLineInfo | null => {
  const match = line.match(CHECKLIST_LINE);
  if (!match) return null;
  const [, indent, mark, text] = match;
  return { indent, checked: mark.toLowerCase() === 'x', text };
};

export interface ContentBlock {
  type: 'checklist' | 'markdown';
  lines: string[];
  startLine: number;
}

export const splitIntoBlocks = (markdown: string): ContentBlock[] => {
  const lines = markdown.split('\n');
  const blocks: ContentBlock[] = [];
  let current: ContentBlock | null = null;

  lines.forEach((line, index) => {
    const type: ContentBlock['type'] = CHECKLIST_LINE.test(line) ? 'checklist' : 'markdown';
    if (current && current.type === type) {
      current.lines.push(line);
    } else {
      current = { type, lines: [line], startLine: index };
      blocks.push(current);
    }
  });

  return blocks;
};

export const toggleChecklistLine = (markdown: string, lineIndex: number): string => {
  const lines = markdown.split('\n');
  const line = lines[lineIndex];
  if (line === undefined) return markdown;
  const match = line.match(CHECKLIST_LINE);
  if (!match) return markdown;
  const [, indent, mark, text] = match;
  const newMark = mark.toLowerCase() === 'x' ? ' ' : 'x';
  lines[lineIndex] = `${indent}- [${newMark}] ${text}`;
  return lines.join('\n');
};

export const getChecklistProgress = (markdown: string): { total: number; checked: number } | null => {
  const lines = markdown.split('\n');
  let total = 0;
  let checked = 0;
  for (const line of lines) {
    const info = parseChecklistLine(line);
    if (!info) continue;
    total += 1;
    if (info.checked) checked += 1;
  }
  return total > 0 ? { total, checked } : null;
};

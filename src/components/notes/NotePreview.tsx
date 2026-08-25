import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { splitIntoBlocks, parseChecklistLine } from '../../utils/markdownChecklist';

interface NotePreviewProps {
  content: string;
  onToggleLine: (lineIndex: number) => void;
}

export function NotePreview({ content, onToggleLine }: NotePreviewProps) {
  const blocks = splitIntoBlocks(content);

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      {blocks.map((block, blockIndex) => {
        if (block.type === 'checklist') {
          return (
            <div key={blockIndex} className="not-prose space-y-1 my-2">
              {block.lines.map((line, lineOffset) => {
                const info = parseChecklistLine(line);
                if (!info) return null;
                const globalLineIndex = block.startLine + lineOffset;
                return (
                  <label key={globalLineIndex} className="flex items-start gap-2 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={info.checked}
                      onChange={() => onToggleLine(globalLineIndex)}
                      className="mt-0.5 accent-verdigris"
                    />
                    <span className={info.checked ? 'line-through text-gray-400 dark:text-gray-500' : 'text-graphite dark:text-stone'}>
                      {info.text}
                    </span>
                  </label>
                );
              })}
            </div>
          );
        }

        if (!block.lines.join('\n').trim()) return null;

        return (
          <ReactMarkdown key={blockIndex} remarkPlugins={[remarkGfm]}>
            {block.lines.join('\n')}
          </ReactMarkdown>
        );
      })}
    </div>
  );
}

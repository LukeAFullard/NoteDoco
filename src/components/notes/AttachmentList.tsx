import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Paperclip, File as FileIcon, Trash2 } from 'lucide-react';
import { getAttachmentsByNote, putAttachment, deleteAttachment } from '../../db';
import type { Attachment } from '../../types';
import { formatBytes } from '../../utils/attachments';
import { Button } from '../ui/Button';

interface AttachmentListProps {
  noteId: string;
}

const LARGE_FILE_THRESHOLD = 20 * 1024 * 1024; // 20 MB

export function AttachmentList({ noteId }: AttachmentListProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [objectUrls, setObjectUrls] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadAttachments = async () => {
    const list = await getAttachmentsByNote(noteId);
    setAttachments(list);
  };

  useEffect(() => {
    loadAttachments();
  }, [noteId]);

  // Manage object URLs for image attachments and clean up to prevent memory leaks
  useEffect(() => {
    const urls: Record<string, string> = {};
    attachments.forEach((att) => {
      if (att.mimeType.startsWith('image/')) {
        urls[att.id] = URL.createObjectURL(att.blob);
      }
    });
    setObjectUrls(urls);

    return () => {
      Object.values(urls).forEach((url) => URL.revokeObjectURL(url));
    };
  }, [attachments]);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      if (file.size >= LARGE_FILE_THRESHOLD) {
        const confirmAttach = window.confirm(
          `"${file.name}" is over 20MB (${formatBytes(file.size)}) and will use significant local storage. Continue?`
        );
        if (!confirmAttach) continue;
      }

      const attachment: Attachment = {
        id: crypto.randomUUID(),
        noteId,
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        blob: file,
        createdAt: new Date().toISOString(),
      };

      await putAttachment(attachment);
    }

    e.target.value = '';
    await loadAttachments();
  };

  const handleDelete = async (att: Attachment) => {
    if (!window.confirm(`Delete attachment "${att.filename}"?`)) return;
    await deleteAttachment(att.id);
    await loadAttachments();
  };

  return (
    <div className="p-4 border-t border-graphite/10 dark:border-white/10">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-graphite dark:text-stone flex items-center gap-1.5">
          <Paperclip size={16} /> Attachments {attachments.length > 0 && `(${attachments.length})`}
        </h3>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          className="gap-1.5"
        >
          <Paperclip size={14} /> Attach file
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {attachments.length === 0 ? (
        <p className="text-xs text-gray-500 dark:text-gray-400 italic">No attached files.</p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {attachments.map((att) => {
            const isImage = att.mimeType.startsWith('image/');
            const previewUrl = objectUrls[att.id];

            return (
              <div
                key={att.id}
                className="group relative flex items-center gap-2 p-2 rounded-panel border border-graphite/10 dark:border-white/10 bg-white dark:bg-graphite text-graphite dark:text-stone max-w-xs"
              >
                {isImage && previewUrl ? (
                  <img
                    src={previewUrl}
                    alt={att.filename}
                    className="w-10 h-10 object-cover rounded"
                  />
                ) : (
                  <div className="w-10 h-10 rounded bg-graphite/5 dark:bg-white/5 flex items-center justify-center shrink-0">
                    <FileIcon size={20} className="text-gray-500 dark:text-gray-400" />
                  </div>
                )}

                <div className="flex-1 min-w-0 pr-6">
                  <p className="text-xs font-medium truncate" title={att.filename}>
                    {att.filename}
                  </p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 font-mono">
                    {formatBytes(att.size)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleDelete(att)}
                  className="absolute right-2 top-2 text-gray-400 hover:text-rust"
                  aria-label={`Delete attachment ${att.filename}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

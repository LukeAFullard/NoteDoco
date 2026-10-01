import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { isTypingTarget } from '@/app/shortcuts';
import { useInPane, useIsActivePane } from '@/app/paneContext';
import { showToast } from '@/design/toast';
import { addAttachment, attachmentMarkdown } from '@/data/repos/attachments';
import { setBodyText } from '@/data/repos/items';
import type { Id } from '@/data/types';
import { newNote, stickiesFromLines } from './capture';

/**
 * Paste (or drop) onto a collection to create items: text becomes a note, or one sticky per
 * line on the stickies wall; images and files become a note with them attached.
 */
export function usePasteToCreate(groupId: Id | null, mode: 'note' | 'stickies' = 'note') {
  const navigate = useNavigate();
  // With panes side by side, only the pane in use takes a paste, and only the pane dropped on takes a drop.
  const isActive = useIsActivePane();
  const inPane = useInPane();
  useEffect(() => {
    const fromData = async (data: DataTransfer | null) => {
      if (!data) return false;
      const files = [...data.files];
      if (files.length) {
        const id = await newNote(groupId);
        const parts: string[] = [];
        for (const f of files) parts.push(attachmentMarkdown(await addAttachment(id, f)));
        await setBodyText(id, `${files.length === 1 ? files[0]!.name : 'Pasted files'}\n\n${parts.join('\n\n')}`);
        navigate(`/items/${id}`);
        return true;
      }
      const text = data.getData('text/plain').trim();
      if (!text) return false;
      if (mode === 'stickies') {
        const ids = await stickiesFromLines(text, groupId);
        showToast({ message: ids.length === 1 ? 'Added a sticky' : `Added ${ids.length} stickies` }, 3000);
      } else {
        navigate(`/items/${await newNote(groupId, text)}`);
      }
      return true;
    };
    const onPaste = (e: ClipboardEvent) => {
      if (!isActive() || isTypingTarget(e.target) || document.querySelector('[role="dialog"]')) return;
      e.preventDefault();
      void fromData(e.clipboardData);
    };
    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files') || isTypingTarget(e.target) || !inPane(e.target)) return;
      e.preventDefault();
      void fromData(e.dataTransfer);
    };
    window.addEventListener('paste', onPaste);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('paste', onPaste);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
    };
  }, [groupId, mode, navigate, isActive, inPane]);
}

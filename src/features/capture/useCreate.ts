import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useUi } from '@/app/ui';
import { openSticky } from '@/features/stickies/stickyDialog';
import { newNote, newSticky } from './capture';

/** Create-and-open actions: a note opens in the editor, a sticky in its dialog. */
export function useCreate() {
  const navigate = useNavigate();
  return useMemo(
    () => ({
      note: async (groupId = useUi.getState().currentGroupId) => navigate(`/items/${await newNote(groupId)}`),
      sticky: async (groupId = useUi.getState().currentGroupId) => openSticky(await newSticky(groupId), true),
    }),
    [navigate],
  );
}


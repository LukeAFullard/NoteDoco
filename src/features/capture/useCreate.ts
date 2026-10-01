import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useUi } from '@/app/ui';
import { openSticky } from '@/features/stickies/stickyDialog';
import { newInk, newNote, newSticky } from './capture';

/** Create-and-open actions: notes and ink notes open in their editors, a sticky in its dialog. */
export function useCreate() {
  const navigate = useNavigate();
  return useMemo(
    () => ({
      note: async (groupId = useUi.getState().currentGroupId) => navigate(`/items/${await newNote(groupId)}`),
      ink: async (groupId = useUi.getState().currentGroupId) => navigate(`/items/${await newInk(groupId)}`),
      sticky: async (groupId = useUi.getState().currentGroupId) => openSticky(await newSticky(groupId), true),
    }),
    [navigate],
  );
}


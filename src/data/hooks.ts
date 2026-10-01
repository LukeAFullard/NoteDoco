import { useLiveQuery } from 'dexie-react-hooks';
import { listGroups, buildTree } from './repos/groups';
import { listItems, listTrash } from './repos/items';
import { objectUrlFor } from './repos/attachments';
import type { Id } from './types';

/** Live queries: every open view (and tab) updates when the data changes. */
export const useGroups = () => useLiveQuery(listGroups, [], undefined);
export const useGroupTree = () => useLiveQuery(async () => buildTree(await listGroups()), [], undefined);
export const useItems = (groupId: Id | null) => useLiveQuery(() => listItems(groupId), [groupId], undefined);
export const useTrash = () => useLiveQuery(listTrash, [], undefined);

/** A displayable URL for a stored attachment (an image), or null while loading or if it's gone. */
export function useAttachmentUrl(id: Id | null | undefined): string | null {
  return useLiveQuery(async () => (id ? objectUrlFor(id) : null), [id], null);
}

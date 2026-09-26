import { useLiveQuery } from 'dexie-react-hooks';
import { listGroups, buildTree } from './repos/groups';
import { listItems, listTrash } from './repos/items';
import type { Id } from './types';

/** Live queries: every open view (and tab) updates when the data changes. */
export const useGroups = () => useLiveQuery(listGroups, [], undefined);
export const useGroupTree = () => useLiveQuery(async () => buildTree(await listGroups()), [], undefined);
export const useItems = (groupId: Id | null) => useLiveQuery(() => listItems(groupId), [groupId], undefined);
export const useTrash = () => useLiveQuery(listTrash, [], undefined);

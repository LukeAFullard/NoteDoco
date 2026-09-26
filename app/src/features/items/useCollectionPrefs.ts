import { useState } from 'react';
import { readPref, writePref } from '@/lib/localPref';
import type { CollectionPrefs } from './ItemCollection';

/** View and sort for a collection that isn't a group (Inbox, Stickies…), remembered per device. */
export function useLocalCollectionPrefs(key: string, fallback: CollectionPrefs): [CollectionPrefs, (p: CollectionPrefs) => void] {
  const [prefs, setPrefs] = useState<CollectionPrefs>(() => readPref(`view:${key}`, fallback));
  return [
    prefs,
    (p) => {
      setPrefs(p);
      writePref(`view:${key}`, p);
    },
  ];
}

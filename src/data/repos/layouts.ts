import { db } from '../db';
import type { Id, Layout } from '../types';
import { newId } from '@/lib/ids';

/** Saved views (TIME-9 timeline layouts; later WS-4 workspaces). */
export async function listLayouts(kind: Layout['kind']): Promise<Layout[]> {
  return (await db.layouts.where('kind').equals(kind).toArray()).sort((a, b) => a.name.localeCompare(b.name));
}

export async function saveLayout(kind: Layout['kind'], name: string, spec: unknown): Promise<Id> {
  const existing = (await listLayouts(kind)).find((l) => l.name.toLowerCase() === name.toLowerCase());
  const id = existing?.id ?? newId();
  await db.layouts.put({ id, kind, name, spec });
  return id;
}

export async function deleteLayout(id: Id): Promise<Layout | undefined> {
  const l = await db.layouts.get(id);
  await db.layouts.delete(id);
  return l;
}

export async function putLayout(l: Layout) {
  await db.layouts.put(l);
}

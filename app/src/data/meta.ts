import { newId, nowIso } from '@/lib/ids';
import { deviceId } from './device';
import type { Meta } from './types';

/** Fields for a brand-new record. */
export function freshMeta(at = nowIso()): Meta {
  return { id: newId(), createdAt: at, updatedAt: at, deletedAt: null, rev: 1, updatedBy: deviceId() };
}

/** Applies a patch and stamps the write (updatedAt, rev, updatedBy). */
export function touched<T extends Meta>(record: T, patch: Partial<NoInfer<T>>, at = nowIso()): T {
  return { ...record, ...patch, updatedAt: at, rev: record.rev + 1, updatedBy: deviceId() };
}

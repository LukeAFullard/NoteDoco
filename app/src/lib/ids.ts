import { uuidv7 } from 'uuidv7';

/** UUIDv7: sortable by creation time and safe to generate on any device. */
export const newId = (): string => uuidv7();

export const nowIso = (): string => new Date().toISOString();

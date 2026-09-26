import '@testing-library/jest-dom/vitest';
import { Blob as NodeBlob } from 'node:buffer';

// Browsers store Blobs in IndexedDB natively. The test DOM's Blob can't be structured-cloned
// by the in-memory IndexedDB, but Node's can, so tests use Node's Blob.
globalThis.Blob = NodeBlob as unknown as typeof Blob;

// Imported after the Blob swap so the in-memory IndexedDB clones Node Blobs.
// @ts-expect-error -- the package's typings aren't exposed through its "exports" map
await import('fake-indexeddb/auto');

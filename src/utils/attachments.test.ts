import { describe, it, expect, vi, afterEach } from 'vitest';
import { formatBytes, getStorageEstimate } from './attachments';

describe('formatBytes', () => {
  it('formats byte numbers correctly', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(-10)).toBe('0 B');
    expect(formatBytes(500)).toBe('500 B');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(2500)).toBe('2.4 KB');
    expect(formatBytes(1048576)).toBe('1 MB');
    expect(formatBytes(25165824)).toBe('24 MB');
    expect(formatBytes(1073741824)).toBe('1 GB');
  });
});

describe('getStorageEstimate', () => {
  const originalStorage = navigator.storage;

  afterEach(() => {
    Object.defineProperty(navigator, 'storage', {
      value: originalStorage,
      writable: true,
      configurable: true,
    });
  });

  it('returns storage estimate when supported', async () => {
    const mockEstimate = vi.fn().mockResolvedValue({ usage: 123456, quota: 987654321 });
    Object.defineProperty(navigator, 'storage', {
      value: { estimate: mockEstimate },
      writable: true,
      configurable: true,
    });

    const result = await getStorageEstimate();
    expect(result).toEqual({ usage: 123456, quota: 987654321 });
  });

  it('returns null when navigator.storage is missing or estimate rejects', async () => {
    Object.defineProperty(navigator, 'storage', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    expect(await getStorageEstimate()).toBeNull();

    const mockEstimateErr = vi.fn().mockRejectedValue(new Error('Permission denied'));
    Object.defineProperty(navigator, 'storage', {
      value: { estimate: mockEstimateErr },
      writable: true,
      configurable: true,
    });

    expect(await getStorageEstimate()).toBeNull();
  });
});

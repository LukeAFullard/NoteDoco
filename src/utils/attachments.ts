export const formatBytes = (bytes: number): string => {
  if (bytes <= 0 || isNaN(bytes)) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const index = Math.min(i, sizes.length - 1);
  const val = bytes / Math.pow(k, index);
  const formatted = val % 1 === 0 ? val.toString() : val.toFixed(1);
  return `${formatted} ${sizes[index]}`;
};

export interface StorageEstimateResult {
  usage?: number;
  quota?: number;
}

export const getStorageEstimate = async (): Promise<StorageEstimateResult | null> => {
  if (typeof navigator === 'undefined' || !navigator.storage || typeof navigator.storage.estimate !== 'function') {
    return null;
  }
  try {
    const estimate = await navigator.storage.estimate();
    return {
      usage: estimate.usage,
      quota: estimate.quota,
    };
  } catch {
    return null;
  }
};

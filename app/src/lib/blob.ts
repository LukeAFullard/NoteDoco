/** A Blob's bytes. Uses Blob.arrayBuffer where available, FileReader otherwise (older engines, test DOMs). */
export async function blobBytes(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === 'function') return new Uint8Array(await blob.arrayBuffer());
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(new Uint8Array(r.result as ArrayBuffer));
    r.onerror = () => reject(r.error);
    r.readAsArrayBuffer(blob);
  });
}

export async function blobText(blob: Blob): Promise<string> {
  return new TextDecoder().decode(await blobBytes(blob));
}

export type DiffLine = { type: 'same' | 'added' | 'removed'; text: string };

/**
 * Line diff (longest common subsequence), for comparing a note with an older version.
 * Notes are small, so the O(n·m) table is fine; very long notes fall back to a coarse diff.
 */
export function diffLines(before: string, after: string): DiffLine[] {
  const a = before.split('\n');
  const b = after.split('\n');
  if (a.length * b.length > 4_000_000) {
    return [...a.map((text) => ({ type: 'removed' as const, text })), ...b.map((text) => ({ type: 'added' as const, text }))];
  }
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i]![j] = a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push({ type: 'same', text: a[i]! });
      i++;
      j++;
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) out.push({ type: 'removed', text: a[i++]! });
    else out.push({ type: 'added', text: b[j++]! });
  }
  while (i < a.length) out.push({ type: 'removed', text: a[i++]! });
  while (j < b.length) out.push({ type: 'added', text: b[j++]! });
  return out;
}

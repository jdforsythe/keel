/** The source whose line starts `starts` holds: the last one asked about, so many offsets of one file cost one scan. */
let indexed: string | undefined;
let starts: readonly number[] = [0];

/** The offsets at which the lines of `source` begin, the first 0. */
function lineStarts(source: string): readonly number[] {
  if (indexed === source) return starts;
  const out = [0];
  for (let i = 0; i < source.length; i++) if (source.charCodeAt(i) === 10) out.push(i + 1);
  indexed = source;
  starts = out;
  return out;
}

/** 1-based line and column of a UTF-16 offset in `source` (the compiler's convention). */
export function lineCol(source: string, offset: number): { line: number; col: number } {
  const end = Math.max(0, Math.min(offset, source.length));
  const at = lineStarts(source);
  let lo = 0;
  let hi = at.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if ((at[mid] ?? 0) <= end) lo = mid;
    else hi = mid - 1;
  }
  return { line: lo + 1, col: end - (at[lo] ?? 0) + 1 };
}

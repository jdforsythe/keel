/** 1-based line and column of a UTF-16 offset in `source`. */
export function lineCol(source: string, offset: number): { line: number; col: number } {
  let line = 1;
  let start = 0;
  const end = Math.min(offset, source.length);
  for (let i = 0; i < end; i++) {
    if (source.charCodeAt(i) === 10) {
      line++;
      start = i + 1;
    }
  }
  return { line, col: end - start + 1 };
}

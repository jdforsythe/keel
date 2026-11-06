/** 1-based line and column of a UTF-16 offset. */
export function lineCol(src: string, offset: number): { line: number; col: number } {
  const before = src.slice(0, offset);
  const line = before.split("\n").length;
  return { line, col: offset - before.lastIndexOf("\n") };
}

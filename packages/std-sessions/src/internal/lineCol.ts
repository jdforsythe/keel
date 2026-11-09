/** 1-based line and column (UTF-16) of offset `at` in `source`. */
export function lineCol(source: string, at: number): { line: number; col: number } {
  const before = source.slice(0, at);
  const nl = before.lastIndexOf("\n");
  return { line: before.split("\n").length, col: at - nl };
}

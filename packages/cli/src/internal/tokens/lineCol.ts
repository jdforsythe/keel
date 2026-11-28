/** The 1-based line and column of offset `at` in `text`. */
export function lineCol(text: string, at: number): { line: number; col: number } {
  const before = text.slice(0, at);
  return { line: before.split("\n").length, col: at - before.lastIndexOf("\n") };
}

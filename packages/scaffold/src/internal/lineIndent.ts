/** The leading whitespace of the line containing `offset`. */
export function lineIndent(src: string, offset: number): string {
  const start = src.lastIndexOf("\n", offset - 1) + 1;
  return /^[ \t]*/.exec(src.slice(start))?.[0] ?? "";
}

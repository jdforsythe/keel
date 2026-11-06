/** `s` on one line, at most `n` chars (ellipsis when cut). Keeps every message under the 90-char contract. */
export function clip(s: string, n: number): string {
  const one = s.replace(/\s*\n\s*/g, " ").trim();
  return one.length > n ? `${one.slice(0, n - 3)}...` : one;
}

/** A name as a message shows it: at most `n` characters. */
export function cut(v: unknown, n = 24): string {
  return String(v).slice(0, n);
}

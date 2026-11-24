/**
 * `s` on one line, at most `n` UTF-16 code units (k.check Diagnostics): each whitespace run holding a line feed becomes
 * one space and the ends are trimmed; a longer text keeps `n - 3` units, or one fewer when the last kept unit is the
 * first half of a surrogate pair, then `...`.
 */
export function clipMessage(s: string, n: number): string {
  const one = s.replace(/\s*\n\s*/g, " ").trim();
  if (one.length <= n) return one;
  let keep = n - 3;
  const last = one.charCodeAt(keep - 1);
  if (last >= 0xd800 && last <= 0xdbff) keep -= 1;
  return `${one.slice(0, keep)}...`;
}

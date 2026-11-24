/**
 * A diagnostic's message by the k.check rule: one line of at most 89 UTF-16 code units. Each whitespace run holding a
 * line feed becomes one space and the ends are trimmed; a longer message keeps 86 units, or 85 when the 86th is the
 * first half of a surrogate pair, then `...`.
 */
export function clipMessage(message: string): string {
  const one = message.replace(/\s*\n\s*/g, " ").trim();
  if (one.length <= 89) return one;
  const last = one.charCodeAt(85);
  const keep = last >= 0xd800 && last <= 0xdbff ? 85 : 86;
  return `${one.slice(0, keep)}...`;
}

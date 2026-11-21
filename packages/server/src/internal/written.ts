/**
 * A record's variable part as the log writes it (k.serverlog): each control character (U+0000 to U+001F, U+007F to
 * U+009F), U+2028, U+2029 and `…` as `\u` and four lowercase hex digits, so a part is one line and holds no `…` of its
 * own; past `max` written characters the longest head that fits, then `…+<n>`, `n` the characters of `text` left out.
 * Reads at most `max` characters of `text`.
 */
export function written(text: string, max: number): string {
  let out = "";
  let i = 0;
  for (; i < text.length; i++) {
    const c = text.charCodeAt(i);
    const e =
      c < 32 || (c > 126 && c < 160) || c === 0x2026 || (c | 1) === 0x2029
        ? `\\u${c.toString(16).padStart(4, "0")}`
        : text.charAt(i);
    if (out.length + e.length > max) return `${out}…+${text.length - i}`;
    out += e;
  }
  return out;
}

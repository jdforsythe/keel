/**
 * `s` with each code point case-folded where that keeps its length in code units (upper-cased, then lower-cased), so
 * an index into the result is an index into `s`. A code point whose folded form has another length (`ß`, `İ`, a
 * ligature) and a lone surrogate stay as they are.
 */
export function folded(s: string): string {
  const out: string[] = [];
  for (const ch of s) {
    const c = ch.charCodeAt(0);
    if (c < 128) out.push(c >= 65 && c <= 90 ? String.fromCharCode(c + 32) : ch);
    else {
      const f = ch.toUpperCase().toLowerCase();
      out.push(f.length === ch.length ? f : ch);
    }
  }
  return out.join("");
}

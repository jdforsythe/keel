const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/**
 * `length` base64 characters derived from `from` (FNV-1a, then a linear congruential walk). Pure; the generator of
 * `Digested` uses it. The last character has its unused low bits clear, so the text is canonical base64.
 */
export function simText(from: string, length: number): string {
  let a = 2166136261;
  for (let i = 0; i < from.length; i++) a = Math.imul(a ^ from.charCodeAt(i), 16777619) >>> 0;
  const spare = (length * 6) % 8;
  let out = "";
  for (let i = 0; i < length; i++) {
    a = (Math.imul(a, 1664525) + 1013904223) >>> 0;
    const at = a >>> 26;
    out += B64.charAt(i === length - 1 ? at & ~((1 << spare) - 1) : at);
  }
  return out;
}

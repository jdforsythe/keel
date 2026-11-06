/** Format four uint32 words as an RFC 4122 v4 UUID (version and variant bits forced). */
export function uuidFromWords(a: number, b: number, c: number, d: number): string {
  const hex = (w: number): string => (w >>> 0).toString(16).padStart(8, "0");
  const h = hex(a) + hex((b & 0xffff0fff) | 0x00004000) + hex((c & 0x3fffffff) | 0x80000000) + hex(d);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

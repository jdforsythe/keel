/** A deterministic [0, 1) stream seeded by the FNV-1a hash of `parts` (mulberry32). */
export function seeded(...parts: readonly (string | number)[]): () => number {
  let h = 0x811c9dc5;
  for (const ch of parts.join("\u0000")) {
    h ^= ch.codePointAt(0) ?? 0;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  let a = h;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  };
}

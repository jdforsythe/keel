/** Derive a capability seed from the ctx seed and the capability name (FNV-1a of the name, xor-ed into the seed). */
export function deriveSeed(seed: number, name: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) {
    hash ^= name.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (seed ^ hash) >>> 0;
}

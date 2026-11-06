/**
 * xoshiro128** PRNG seeded through splitmix32. Returns a generator of uint32 values.
 * The seed is coerced to uint32 (`seed >>> 0`). Same seed, same sequence, on every platform.
 */
export function xoshiro128(seed: number): () => number {
  let sm = seed >>> 0;
  const splitmix32 = (): number => {
    sm = (sm + 0x9e3779b9) | 0;
    let t = sm ^ (sm >>> 16);
    t = Math.imul(t, 0x21f0aaad);
    t ^= t >>> 15;
    t = Math.imul(t, 0x735a2d97);
    return (t ^ (t >>> 15)) >>> 0;
  };
  let s0 = splitmix32();
  let s1 = splitmix32();
  let s2 = splitmix32();
  let s3 = splitmix32();
  const rotl = (x: number, k: number): number => (x << k) | (x >>> (32 - k));
  return () => {
    const result = Math.imul(rotl(Math.imul(s1, 5), 7), 9) >>> 0;
    const t = s1 << 9;
    s2 ^= s0;
    s3 ^= s1;
    s1 ^= s2;
    s0 ^= s3;
    s2 ^= t;
    s3 = rotl(s3, 11);
    return result;
  };
}

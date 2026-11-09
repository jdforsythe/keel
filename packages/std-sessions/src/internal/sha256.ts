const K: number[] = [];
const H0: number[] = [];
{
  // The first 64 primes' cube-root (K) and the first 8 primes' square-root (H0) fractions (FIPS 180-4).
  const frac = (x: number): number => ((x - Math.floor(x)) * 2 ** 32) >>> 0;
  for (let n = 2; K.length < 64; n++) {
    let prime = true;
    for (let d = 2; d * d <= n; d++) if (n % d === 0) prime = false;
    if (!prime) continue;
    if (H0.length < 8) H0.push(frac(n ** 0.5));
    K.push(frac(n ** (1 / 3)));
  }
}

const rotr = (x: number, n: number): number => (x >>> n) | (x << (32 - n));

/** SHA-256 of `text` (UTF-8) as 64 lowercase hex characters. Synchronous, for `stop()` (rfc:0070 §5). */
export function sha256(text: string): string {
  const bytes = new TextEncoder().encode(text);
  const len = bytes.length;
  const blocks = ((len + 9 + 63) >> 6) << 4;
  const w = new Uint32Array(blocks);
  for (let i = 0; i < len; i++) w[i >> 2] = (w[i >> 2] ?? 0) | ((bytes[i] ?? 0) << (24 - (i % 4) * 8));
  w[len >> 2] = (w[len >> 2] ?? 0) | (0x80 << (24 - (len % 4) * 8));
  w[blocks - 1] = len * 8;
  w[blocks - 2] = Math.floor((len * 8) / 2 ** 32);
  const h = H0.slice();
  const m = new Uint32Array(64);
  for (let b = 0; b < blocks; b += 16) {
    for (let t = 0; t < 64; t++) {
      if (t < 16) m[t] = w[b + t] ?? 0;
      else {
        const a = m[t - 15] ?? 0;
        const c = m[t - 2] ?? 0;
        const s0 = rotr(a, 7) ^ rotr(a, 18) ^ (a >>> 3);
        const s1 = rotr(c, 17) ^ rotr(c, 19) ^ (c >>> 10);
        m[t] = (m[t - 16] ?? 0) + s0 + (m[t - 7] ?? 0) + s1;
      }
    }
    let [A = 0, B = 0, C = 0, D = 0, E = 0, F = 0, G = 0, Hh = 0] = h;
    for (let t = 0; t < 64; t++) {
      const t1 = (Hh + (rotr(E, 6) ^ rotr(E, 11) ^ rotr(E, 25)) + ((E & F) ^ (~E & G)) + (K[t] ?? 0) + (m[t] ?? 0)) | 0;
      const t2 = ((rotr(A, 2) ^ rotr(A, 13) ^ rotr(A, 22)) + ((A & B) ^ (A & C) ^ (B & C))) | 0;
      Hh = G;
      G = F;
      F = E;
      E = (D + t1) | 0;
      D = C;
      C = B;
      B = A;
      A = (t1 + t2) | 0;
    }
    const next = [A, B, C, D, E, F, G, Hh];
    for (let i = 0; i < 8; i++) h[i] = ((h[i] ?? 0) + (next[i] ?? 0)) >>> 0;
  }
  return h.map((x) => x.toString(16).padStart(8, "0")).join("");
}

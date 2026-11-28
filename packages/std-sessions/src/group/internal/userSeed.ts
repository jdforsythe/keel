/**
 * User `index`'s sim seed in a group of seed `seed` (std.multi): a 32-bit mix of both, so users draw distinct ids
 * and one group seed fixes every user's.
 */
export function userSeed(seed: number, index: number): number {
  let x = (Math.trunc(seed) ^ Math.imul(index + 1, 0x9e3779b9)) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
}

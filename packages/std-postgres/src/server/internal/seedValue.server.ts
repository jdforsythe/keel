/**
 * The `setseed` argument (in [-1, 1]) for the `n`-th call of a sim database whose capability seed is `seed`, so
 * `random()` gives one sequence per seed and call order.
 */
export function seedValue(seed: number, n: number): number {
  let x = (seed ^ Math.imul(n + 1, 0x9e3779b9)) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  x = (x ^ (x >>> 16)) >>> 0;
  return (x / 0xffffffff) * 2 - 1;
}

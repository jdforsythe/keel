import type { Vec3 } from "./Vec3.ts";

/** `m` times the column `v`. */
export function mulMatrix(m: readonly [Vec3, Vec3, Vec3], v: Vec3): Vec3 {
  const row = (r: Vec3): number => r[0] * v[0] + r[1] * v[1] + r[2] * v[2];
  return [row(m[0]), row(m[1]), row(m[2])];
}

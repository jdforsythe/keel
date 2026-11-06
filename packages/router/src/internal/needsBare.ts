import type { Level } from "./Level.ts";

/**
 * Whether an error shown at chain index `level` before guards or loaders ran must render alone: some layout
 * above it declares a loader (its data is missing) or a guard (it did not run).
 */
export function needsBare(chain: readonly Level[], level: number): boolean {
  return chain.slice(0, Math.max(level, 0)).some((l) => l.def.loader !== undefined || l.def.guard !== undefined);
}

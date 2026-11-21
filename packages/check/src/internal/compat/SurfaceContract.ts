import type { SurfaceEntry } from "./SurfaceEntry.ts";

/** One contract in `surface.json` (k.compat Surface): its module, the modules importing it, its API entries by id. */
export type SurfaceContract = {
  readonly module: string;
  readonly callers: readonly string[];
  readonly entries: ReadonlyMap<string, SurfaceEntry>;
};

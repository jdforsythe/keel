import type { SurfaceContract } from "./SurfaceContract.ts";
import type { SurfaceStore } from "./SurfaceStore.ts";

/** `.keel/surface.json` data (`version` 2 or 3) as `keel check` reads it: each contract by module, each store by id. */
export type Surface = {
  readonly contracts: ReadonlyMap<string, SurfaceContract>;
  readonly stores: ReadonlyMap<string, SurfaceStore>;
};

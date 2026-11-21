import type { SurfaceContract } from "./SurfaceContract.ts";
import type { SurfaceStore } from "./SurfaceStore.ts";

/**
 * `.keel/surface.json` data (`version: 2`) as `keel check` reads it: each contract by module, each store by id, and
 * `sources`, each evaluated file's content hash.
 */
export type Surface = {
  readonly contracts: ReadonlyMap<string, SurfaceContract>;
  readonly stores: ReadonlyMap<string, SurfaceStore>;
  readonly sources: ReadonlyMap<string, string>;
};

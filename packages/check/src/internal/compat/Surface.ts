import type { SurfaceRoute } from "./SurfaceRoute.ts";
import type { SurfaceService } from "./SurfaceService.ts";
import type { SurfaceStore } from "./SurfaceStore.ts";

/** `.keel/surface.json` data as `keel check` reads it; `sources` maps each evaluated file to its content hash. */
export type Surface = {
  readonly routes: readonly SurfaceRoute[];
  readonly services: readonly SurfaceService[];
  readonly stores: ReadonlyMap<string, SurfaceStore>;
  readonly sources: ReadonlyMap<string, string>;
};

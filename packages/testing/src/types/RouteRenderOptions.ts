import type { Ctx } from "@keel/ctx";
import type { Manifest, RouteDef } from "@keel/router";
import type { Store } from "@keel/store";
import type { HarnessArtifacts } from "./HarnessArtifacts.ts";

/**
 * Options of `renderRoute`: the route table, the target's params and search (or `url`, a raw path and query parsed as
 * a navigation parses it, in their place), seeded state, ctx, artifacts, and the `caller` id guards, loaders and
 * actions receive (default `""`, anonymous).
 */
export interface RouteRenderOptions<M extends Readonly<Record<string, RouteDef>>> {
  readonly routes: Manifest<M>;
  readonly params?: Readonly<Record<string, unknown>>;
  readonly search?: Readonly<Record<string, unknown>>;
  readonly url?: string;
  readonly state?: readonly (readonly [Store<unknown>, unknown])[];
  readonly ctx?: Ctx;
  readonly caller?: string;
  readonly artifacts?: HarnessArtifacts;
}

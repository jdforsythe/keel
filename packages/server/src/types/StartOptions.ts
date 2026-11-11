import type { Topology } from "@keel/compiler";
import type { Manifest, RouteDef } from "@keel/router";
import type { Runner } from "./Runner.ts";

/**
 * What the generated entry of a `node` deployable hands `start` (k.topology Build): the app's topology, the served
 * deployable, its modules' route manifests and runners, and `dir`, the entry's own folder `dist/<name>/` (client
 * build, `routes.json`, `std.json`).
 */
export type StartOptions = {
  readonly topology: Topology;
  readonly deployable: string;
  readonly routes: readonly Manifest<Readonly<Record<string, RouteDef>>>[];
  readonly runners: Readonly<Record<string, readonly Runner[]>>;
  readonly dir: string;
};

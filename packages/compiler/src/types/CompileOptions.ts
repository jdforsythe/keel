import type { RouteEntry } from "./RouteEntry.ts";
import type { Topology } from "./Topology.ts";

/**
 * `mode`: `"client"` (default) emits DOM ops; `"server"` currently emits the same module.
 * `topology`: the parsed `topology.ts`; E1004 is not reported for files whose deployables all use `adapter: 'client'`.
 * `looks`: the `look` group of `tokens.ts` as data; a literal `look` on a base element or in a part style lowers to the
 * set's classes for every prop and state it does not set itself (without it, `look` adds no class).
 * `routes`: a precomputed `routes.json` (the Vite plugin derives it with `routesArtifact`); default `{}`.
 */
export type CompileOptions = {
  readonly mode?: "client" | "server";
  readonly topology?: Topology;
  readonly routes?: Readonly<Record<string, RouteEntry>>;
  readonly looks?: Readonly<Record<string, unknown>>;
};

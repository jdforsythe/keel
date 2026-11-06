import type { Ctx } from "@keel/ctx";
import type { Guard, Manifest, RouteDef } from "@keel/router";
import type { LogSink } from "./LogSink.ts";
import type { Topology } from "./Topology.ts";

/**
 * Options of `createApp` (generated server entry and `keel dev` only; app code sees only `topology`).
 * `routes` is the union manifest of the deployable's modules. `deployable` names the topology entry to
 * serve (required when there is more than one). `guards` resolves route `guard` names (a route may also
 * hold the `Guard` itself). `mode` defaults to `dev`.
 */
export type AppOptions = {
  readonly topology: Topology;
  readonly routes: Manifest<Readonly<Record<string, RouteDef>>>;
  readonly ctx: Ctx;
  readonly mode?: "dev" | "production";
  readonly deployable?: string;
  readonly guards?: readonly Guard[];
  readonly log?: LogSink;
};

import type { Origins, Topology } from "@keel/compiler";
import type { RouteTable } from "@keel/router";
import type { Identity } from "./Identity.ts";

/**
 * What the generated build entry of a `static` deployable hands `prerender` (k.hosting Static): the app's topology,
 * the served deployable, its route table, the project's identity source when it exists, the static read's `origins`
 * (k.origins), `dir`, the deployable's client build `dist/<name>/`, whose manifest the documents script, and `std`,
 * the build's `.keel/std.json` when it exists, and `artifacts`, the folder of the artifacts a server render reads
 * (`createApp({ artifacts })`), so a prerendered document lists the `choice` themes a node deployable's would.
 */
export type PrerenderOptions = {
  readonly topology: Topology;
  readonly deployable: string;
  readonly routes: RouteTable;
  readonly dir: string;
  readonly std?: string | undefined;
  readonly artifacts?: string | undefined;
  readonly identity?: Identity;
  readonly origins?: Readonly<Record<string, Origins>>;
};

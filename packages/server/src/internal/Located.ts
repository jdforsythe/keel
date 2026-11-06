import type { RouteDef } from "@keel/router";
import type { Level } from "./Level.ts";
import type { Segment } from "./Segment.ts";

/** A routable entry of the served table: compiled path, resolved chain, and owning module id. */
export type Located = {
  readonly id: string;
  readonly module: string;
  readonly def: RouteDef;
  readonly segments: readonly Segment[];
  readonly chain: readonly Level[];
};

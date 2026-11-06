import type { RouteDef } from "../types/RouteDef.ts";
import type { Level } from "./Level.ts";
import type { Segment } from "./Segment.ts";

/** A routable entry of one router's table: compiled path and resolved chain. */
export type Located = {
  readonly id: string;
  readonly def: RouteDef;
  readonly segments: readonly Segment[];
  readonly chain: readonly Level[];
};

import type { Ctx } from "@keel/ctx";
import type { Guard } from "@keel/router";
import type { Located } from "./Located.ts";
import type { Mode } from "./Mode.ts";

/** A built deployable: its routes, `ctx`, mode, and guards by name. */
export type Served = {
  readonly table: readonly Located[];
  readonly ctx: Ctx;
  readonly mode: Mode;
  readonly guards: ReadonlyMap<string, Guard>;
};

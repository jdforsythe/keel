import type { Ctx } from "@keel/ctx";
import type { Guard, Located } from "@keel/router";
import type { Mode } from "./Mode.ts";

/** A built deployable: its routes, `ctx`, mode, guards by name, and the ids of stores exposed to `#k-state`. */
export type Served = {
  readonly table: readonly Located[];
  readonly ctx: Ctx;
  readonly mode: Mode;
  readonly guards: ReadonlyMap<string, Guard>;
  readonly expose: ReadonlySet<string>;
};

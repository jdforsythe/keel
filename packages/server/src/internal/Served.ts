import type { Ctx } from "@keel/ctx";
import type { Guard, Located } from "@keel/router";
import type { Mode } from "./Mode.ts";

/**
 * A built deployable: its routes, `ctx`, mode, guards by name, the stores exposed to `#k-state` (id to whether their
 * log goes too), the action body cap in bytes, and the extra origins the dev inspect endpoint answers.
 */
export type Served = {
  readonly table: readonly Located[];
  readonly ctx: Ctx;
  readonly mode: Mode;
  readonly guards: ReadonlyMap<string, Guard>;
  readonly expose: ReadonlyMap<string, boolean>;
  readonly maxBody: number;
  readonly inspectOrigins: readonly string[];
};

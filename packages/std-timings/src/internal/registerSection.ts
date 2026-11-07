import { inspector } from "@keel/compiler/inspect/inspector";
import type { Ctx } from "@keel/ctx";
import { Timings } from "../Timings.ts";

/** The reader this module instance registered; per module scope, so a second copy of the package does not share it. */
let registered: ((ctx: Ctx) => Timings) | undefined;

/**
 * Register the `timings.recent` section once per module instance: registering the same reader again is a no-op.
 * Any other reader, including one from a second copy of this package, reaches `inspector` and throws E1057.
 */
export function registerSection(read: (ctx: Ctx) => Timings): void {
  if (registered === read) return;
  inspector({ id: "timings.recent", schema: Timings, read });
  registered = read;
}

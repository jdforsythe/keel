import { inspector } from "@keel/compiler/inspect/inspector";
import type { Ctx } from "@keel/ctx";
import { TimingsRecent } from "../TimingsRecent.schema.ts";

/** The reader this module instance registered; per module scope, so a second copy of the package does not share it. */
let registered: ((ctx: Ctx) => TimingsRecent) | undefined;

/**
 * Register the `timings.recent` section (`TimingsRecent`, rfc:0059) once per module instance: registering the same
 * reader again is a no-op. Any other reader, including one from a second copy of this package, reaches `inspector`
 * and throws E1057.
 */
export function registerSection(read: (ctx: Ctx) => TimingsRecent): void {
  if (registered === read) return;
  inspector({ id: "timings.recent", schema: TimingsRecent, read });
  registered = read;
}

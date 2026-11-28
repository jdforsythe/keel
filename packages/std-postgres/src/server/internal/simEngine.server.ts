import type { Engine } from "./Engine.ts";
import { forgetting } from "./forgetting.server.ts";
import { pgliteEngine } from "./pgliteEngine.server.ts";
import { pgliteModules } from "./pgliteModules.server.ts";

let shared: Promise<Engine> | undefined;

/**
 * The one PGlite in memory every sim database of the process shares, each sim ctx and capability in its own schema.
 * Made at the first call (`ready()` makes it ahead of a test run, so no sim query waits on it).
 */
export function simEngine(): Promise<Engine> {
  if (shared === undefined) {
    const made: Promise<Engine> = forgetting(
      () =>
        import("@electric-sql/pglite").then(async ({ PGlite }) =>
          pgliteEngine(await PGlite.create(await pgliteModules())),
        ),
      () => {
        if (shared === made) shared = undefined;
      },
    );
    shared = made;
  }
  return shared;
}

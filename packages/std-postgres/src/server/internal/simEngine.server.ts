import { attempt } from "@keel/schema";
import type { Engine } from "./Engine.ts";
import { pgliteEngine } from "./pgliteEngine.server.ts";
import { pgliteModules } from "./pgliteModules.server.ts";

let shared: Promise<Engine> | undefined;

/**
 * The one PGlite in memory every sim database of the process shares, each sim ctx and capability in its own schema.
 * Made at the first call (`ready()` makes it ahead of a test run, so no sim query waits on it).
 */
export function simEngine(): Promise<Engine> {
  if (shared === undefined) {
    shared = import("@electric-sql/pglite").then(async ({ PGlite }) =>
      pgliteEngine(await PGlite.create(await pgliteModules())),
    );
    const made = shared;
    void attempt(() => made).then((r) => {
      if (!r.ok) shared = undefined;
    });
  }
  return shared;
}

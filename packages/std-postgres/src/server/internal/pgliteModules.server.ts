import { createRequire } from "node:module";
import type { PgliteModules } from "./PgliteModules.ts";
import { compiledPglite } from "./compiledPglite.server.ts";
import { forgetting } from "./forgetting.server.ts";
import { installedPglite } from "./installedPglite.server.ts";

/**
 * Shared by every evaluation of this module in the process, as the open engines are: the modules compile once.
 * Compiling them for each PGlite (each about 9 MB of code) and freeing them when it closes is what a process that
 * opens many folders, or one in memory per test, spends its time on; V8's code allocator has failed on that churn.
 */
const KEY = Symbol.for("@keel/std-postgres:pglite-modules");

/**
 * The process's compiled PGlite modules, or none where no PGlite package is installed (a built server); a failed
 * compile is not kept, so the next call tries again.
 */
export function pgliteModules(): Promise<Partial<PgliteModules>> {
  const kept: unknown = Reflect.get(globalThis, KEY);
  if (kept instanceof Promise) return kept;
  const made: Promise<Partial<PgliteModules>> = forgetting(
    () => compiledPglite(installedPglite(createRequire(import.meta.url).resolve)),
    () => {
      if (Reflect.get(globalThis, KEY) === made) Reflect.deleteProperty(globalThis, KEY);
    },
  );
  Reflect.set(globalThis, KEY, made);
  return made;
}

import { stdImportsNow } from "../internal/stdImportsNow.ts";

/**
 * Whether `importDeps` is importing package `pkg` (its entry or its `./tools` export) at this moment. Code that runs
 * while a module is first evaluated, such as `defineRule` in `@keel/check`, asks it to tell a package `importDeps`
 * imported first in the process from one the caller imported before (k.check-cache In one process): a module Node or
 * the test runner already holds is not evaluated again, so it registers nothing while `importDeps` imports it.
 */
export function stdImporting(pkg: string): boolean {
  return stdImportsNow.has(pkg);
}

import { importRefs } from "./importRefs.ts";
import { isCode } from "./isCode.ts";
import { isTestPath } from "./isTestPath.ts";
import { moduleOf } from "./moduleOf.ts";
import { parseSource } from "./parseSource.ts";
import { resolveImport } from "./resolveImport.ts";
import { sortedKeys } from "./sortedKeys.ts";

const LAYOUT = /\blayout\s*:\s*(['"])([^'".]+)\./g;

/**
 * The app modules each module uses (k.module Checks): a non-test file of it, generated ones among them, imports from
 * that module, or a binding of either module names a layout of the other. Keys are module ids.
 */
export function moduleUses(files: ReadonlyMap<string, string>): Map<string, Set<string>> {
  const uses = new Map<string, Set<string>>();
  const add = (by: string, of: string): void => {
    if (by !== of) uses.set(by, (uses.get(by) ?? new Set<string>()).add(of));
  };
  for (const path of sortedKeys(files.keys())) {
    const src = files.get(path);
    const mine = moduleOf(path);
    if (src === undefined || mine === null || !isCode(path) || isTestPath(path)) continue;
    const program = parseSource(path, src);
    for (const ref of program === null ? [] : importRefs(program)) {
      const target = resolveImport(files, path, ref.spec);
      const to = target === null ? null : moduleOf(target);
      if (to !== null) add(mine, to);
    }
    for (const m of src.matchAll(LAYOUT)) {
      const to = m[2];
      if (to !== undefined && files.has(`modules/${to}/module.ts`)) {
        add(mine, to);
        add(to, mine);
      }
    }
  }
  return uses;
}

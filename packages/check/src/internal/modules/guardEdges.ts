import type { SourceFile } from "../../types/SourceFile.ts";
import type { FileFacts } from "./FileFacts.ts";
import type { ModuleInfo } from "./ModuleInfo.ts";
import { joinPath } from "./joinPath.ts";
import { resolveImport } from "./resolveImport.ts";

const GUARD = /\.guard(?:\.[cm]?[jt]sx?)?$/;

/**
 * The guard files one module imports from another (k.module E1153, k.guards Home): per `<from>\n<to>` pair of module
 * keys, the sorted paths of the `*.guard.*` files of `to` that non-test files of `from` import. Relative imports only.
 */
export function guardEdges(
  scanned: readonly { readonly file: SourceFile; readonly module: ModuleInfo; readonly facts: FileFacts }[],
  p: { readonly modules: readonly ModuleInfo[]; readonly byKey: ReadonlyMap<string, ModuleInfo> },
): ReadonlyMap<string, readonly string[]> {
  const found = new Map<string, Set<string>>();
  for (const { file, module, facts } of scanned) {
    for (const imp of facts.imports) {
      if (!imp.value.startsWith(".")) continue;
      const r = resolveImport(file.path, imp.value, p.modules, p.byKey);
      if (r === null || r.module === module) continue;
      const path = joinPath(file.path.slice(0, Math.max(0, file.path.lastIndexOf("/"))), imp.value);
      if (!GUARD.test(path)) continue;
      const key = `${module.key}\n${r.module.key}`;
      found.set(key, (found.get(key) ?? new Set<string>()).add(path));
    }
  }
  return new Map([...found].map(([k, v]) => [k, [...v].sort()]));
}

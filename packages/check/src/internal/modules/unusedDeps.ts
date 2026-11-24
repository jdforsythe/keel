import type { Diagnostic } from "../../types/Diagnostic.ts";
import type { SourceFile } from "../../types/SourceFile.ts";
import type { Entry } from "./Entry.ts";
import type { FileFacts } from "./FileFacts.ts";
import type { ModuleInfo } from "./ModuleInfo.ts";
import { inNodeModules } from "./inNodeModules.ts";
import { moduleDiag } from "./moduleDiag.ts";
import { removeEntryFix } from "./removeEntryFix.ts";
import { resolveImport } from "./resolveImport.ts";
import { short } from "./short.ts";

/**
 * E1165 (k.module Checks): a `deps` entry, other than a `@keel/std-*` package, that the module does not use; once per
 * entry, at the entry, the fix removes it. A module uses an app module when E1152 would ask for the entry: one of its
 * non-test files imports from that module (contract included), or a binding of either module names a layout of the
 * other. Manifests under `node_modules/` and opaque manifests are not judged.
 */
export function unusedDeps(
  scanned: readonly {
    readonly file: SourceFile;
    readonly module: ModuleInfo;
    readonly facts: FileFacts;
    readonly layouts: readonly Entry[];
  }[],
  p: { readonly modules: readonly ModuleInfo[]; readonly byKey: ReadonlyMap<string, ModuleInfo> },
): Diagnostic[] {
  const used = new Map<ModuleInfo, Set<string>>();
  const use = (by: ModuleInfo, key: string): void => {
    used.set(by, (used.get(by) ?? new Set<string>()).add(key));
  };
  for (const { file, module, facts, layouts } of scanned) {
    for (const imp of facts.imports) {
      const r = resolveImport(file.path, imp.value, p.modules, p.byKey);
      if (r !== null && r.module !== module) use(module, r.module.key);
    }
    for (const l of layouts) {
      const prefix = l.value.slice(0, Math.max(0, l.value.indexOf(".")));
      const target = p.modules.find((m) => m.prefix === prefix);
      if (target === undefined || target === module) continue;
      use(module, target.key);
      use(target, module.key);
    }
  }
  const out: Diagnostic[] = [];
  for (const m of p.modules) {
    const man = m.manifest;
    if (man === null || inNodeModules(m.file.path)) continue;
    const mine = used.get(m);
    man.deps.entries.forEach((e, i) => {
      if (e.value.startsWith("@keel/std-") || mine?.has(e.value) === true) return;
      const msg = `module ${short(m.key)} lists ${short(e.value)} in deps and does not use it`;
      out.push(moduleDiag("E1165", m.file, e.start, msg, removeEntryFix(m.file, man.deps, i)));
    });
  }
  return out;
}

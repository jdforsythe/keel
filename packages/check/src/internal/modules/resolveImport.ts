import { stemOf } from "../stemOf.ts";
import type { ModuleInfo } from "./ModuleInfo.ts";
import { joinPath } from "./joinPath.ts";
import { moduleOf } from "./moduleOf.ts";

const STD = /^(@keel\/std-[^/]+)(?:\/(.+))?$/;

/**
 * The module and export name an import specifier reaches. Relative specifiers resolve against the importing
 * file's folder and name the exporting file (`../catalog/Item.ts` -> `catalog`, `Item`); stdlib specifiers
 * are `@keel/std-x/<File>` (`name` is `null` for the bare package). `null` when no discovered module owns it.
 */
export function resolveImport(
  from: string,
  spec: string,
  modules: readonly ModuleInfo[],
  byKey: ReadonlyMap<string, ModuleInfo>,
): { readonly module: ModuleInfo; readonly name: string | null } | null {
  if (spec.startsWith("./") || spec.startsWith("../")) {
    const path = joinPath(from.slice(0, Math.max(0, from.lastIndexOf("/"))), spec);
    const module = moduleOf(path, modules);
    return module === undefined ? null : { module, name: stemOf(path) };
  }
  const std = STD.exec(spec);
  const key = std?.[1];
  const module = key === undefined ? undefined : byKey.get(key);
  if (module === undefined) return null;
  const rest = std?.[2];
  return { module, name: rest === undefined ? null : stemOf(rest) };
}

import { stemOf } from "../stemOf.ts";
import type { ModuleInfo } from "./ModuleInfo.ts";
import { joinPath } from "./joinPath.ts";
import { moduleOf } from "./moduleOf.ts";

const PACKAGE = /^(@[^/]+\/[^/]+)(?:\/(.+))?$/;
const EXT = /\.[cm]?[jt]sx?$/;

/**
 * The module and export name an import specifier reaches, and whether it is that module's contract (k.contract:
 * `modules/<id>/<id>.contract.ts`, a library's `./contract`). Relative specifiers resolve against the importing
 * file's folder and name the exporting file (`../catalog/Item.ts` -> `catalog`, `Item`); a library's specifiers are
 * `@scope/name/<File>` (`name` is `null` for the bare package); `entry` is true for one naming a subpath its
 * `exports` write whole (`@scope/name/server`, `ModuleInfo` `entries`). `null` when no discovered module owns it.
 */
export function resolveImport(
  from: string,
  spec: string,
  modules: readonly ModuleInfo[],
  byKey: ReadonlyMap<string, ModuleInfo>,
): {
  readonly module: ModuleInfo;
  readonly name: string | null;
  readonly contract: boolean;
  readonly entry: boolean;
} | null {
  if (spec.startsWith("./") || spec.startsWith("../")) {
    const path = joinPath(from.slice(0, Math.max(0, from.lastIndexOf("/"))), spec);
    const module = moduleOf(path, modules);
    if (module === undefined) return null;
    const contract = path.replace(EXT, "") === `${module.root}${module.key}.contract`;
    return { module, name: stemOf(path), contract, entry: false };
  }
  const std = PACKAGE.exec(spec);
  const key = std?.[1];
  const module = key === undefined ? undefined : byKey.get(key);
  if (module === undefined) return null;
  const rest = std?.[2];
  return {
    module,
    name: rest === undefined ? null : stemOf(rest),
    contract: rest?.replace(EXT, "") === "contract",
    entry: rest !== undefined && module.entries.has(rest),
  };
}

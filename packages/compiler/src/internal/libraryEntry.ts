import type { Library } from "../types/Library.ts";
import { keelExportOf } from "./keelExportOf.ts";

/**
 * The file a specifier `spec` (`<name>` or `<name>/<sub>`) of one of `libraries` names: its `exports` entry's `keel`
 * target (k.library Package), else the entry Node's conditions give (`keelExportOf`). Undefined for a specifier of no
 * library or an export the package does not have.
 */
export function libraryEntry(libraries: readonly Library[], spec: string): string | undefined {
  const lib = libraries.find((l) => spec === l.name || spec.startsWith(`${l.name}/`));
  if (lib === undefined) return undefined;
  return keelExportOf(lib.dir, `.${spec.slice(lib.name.length)}`)?.[0];
}

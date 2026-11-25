import path from "node:path";
import type { Library } from "../types/Library.ts";
import { exportOf } from "./exportOf.ts";
import { readJson } from "./readJson.ts";

/**
 * The file a specifier `spec` (`<name>` or `<name>/<sub>`) of one of `libraries` names: its `exports` entry's `keel`
 * target (k.library Package), else the entry Node's conditions give. Undefined for a specifier of no library or an
 * export the package does not have.
 */
export function libraryEntry(libraries: readonly Library[], spec: string): string | undefined {
  const lib = libraries.find((l) => spec === l.name || spec.startsWith(`${l.name}/`));
  if (lib === undefined) return undefined;
  const sub = `.${spec.slice(lib.name.length)}`;
  const pkg = readJson(path.join(lib.dir, "package.json"));
  const exports = typeof pkg === "object" && pkg !== null ? Reflect.get(pkg, "exports") : undefined;
  const entry = typeof exports === "object" && exports !== null ? Reflect.get(exports, sub) : undefined;
  const keel = typeof entry === "object" && entry !== null ? Reflect.get(entry, "keel") : undefined;
  if (typeof keel === "string" && keel.startsWith("./")) return path.resolve(lib.dir, keel);
  return exportOf(lib.dir, sub)?.[0];
}

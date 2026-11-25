import fs from "node:fs";
import type { Library } from "../types/Library.ts";
import { definingFile } from "./definingFile.ts";
import { exportNames } from "./exportNames.ts";
import { libraryEntry } from "./libraryEntry.ts";
import { registersCapability } from "./registersCapability.ts";

/**
 * Whether the export `name` of specifier `spec` of one of `libraries` registers a capability (k.server-deps
 * Registration through a library): its defining file in the library (`definingFile`, through the entry's re-exports)
 * imports `@keel/ctx` and names `register`. `*` (a namespace import, `export *`) asks whether any export does. Answers
 * are kept per specifier and name.
 */
export function libraryRegisters(libraries: readonly Library[]): (spec: string, name: string) => boolean {
  const known = new Map<string, boolean>();
  const direct = (file: string | undefined): boolean => {
    if (file === undefined) return false;
    try {
      return registersCapability(fs.readFileSync(file, "utf8"));
    } catch {
      return false;
    }
  };
  return (spec, name) => {
    const key = `${spec}\0${name}`;
    const held = known.get(key);
    if (held !== undefined) return held;
    const entry = libraryEntry(libraries, spec);
    const names = entry === undefined ? [] : name === "*" ? exportNames(entry) : [name];
    const hit = entry !== undefined && names.some((n) => direct(definingFile(entry, n)));
    known.set(key, hit);
    return hit;
  };
}

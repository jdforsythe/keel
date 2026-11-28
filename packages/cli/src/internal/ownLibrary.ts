import { readFileSync } from "node:fs";
import { join } from "node:path";
import { libraryKind } from "@keel/compiler/std/libraryKind";
import { appMarkedLibrary } from "./appMarkedLibrary.ts";
import { isRecord } from "./isRecord.ts";

/**
 * Binary only: the library whose own folder is `cwd` (k.library-pack Own folder): its `package.json` marks it
 * `"keel": "library"` under a scoped name (`libraryKind`), and it is no app's folder (`appMarkedLibrary`, k.module E1170).
 * Its name, the parsed `package.json` and its text; undefined for any other folder.
 */
export function ownLibrary(
  cwd: string,
): { readonly name: string; readonly pkg: Readonly<Record<string, unknown>>; readonly text: string } | undefined {
  if (appMarkedLibrary(cwd) !== undefined) return undefined;
  let text: string;
  try {
    text = readFileSync(join(cwd, "package.json"), "utf8");
  } catch {
    return undefined;
  }
  let pkg: unknown;
  try {
    pkg = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (!isRecord(pkg) || typeof pkg.name !== "string" || libraryKind(pkg, pkg.name) !== "library") return undefined;
  return { name: pkg.name, pkg, text };
}

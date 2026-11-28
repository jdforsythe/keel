import fs from "node:fs";
import path from "node:path";
import { exportOf } from "./exportOf.ts";
import { readJson } from "./readJson.ts";

/**
 * The real file of export `sub` (`.` or `./x`) of the package in directory `pkg`, with the package's real directory,
 * as every surface reads a library's code (k.library Kind, k.entries): its `exports` entry's `keel` target, the source,
 * whether the package is linked or installed; else the entry Node's conditions give (`exportOf`), as for a stdlib
 * package. Undefined when there is no such export, or its real path is outside the package's real directory.
 */
export function keelExportOf(pkg: string, sub = "."): [file: string, pkg: string] | undefined {
  const manifest = readJson(path.join(pkg, "package.json"));
  const exports = typeof manifest === "object" && manifest !== null ? Reflect.get(manifest, "exports") : undefined;
  const entry = typeof exports === "object" && exports !== null ? Reflect.get(exports, sub) : undefined;
  const keel = typeof entry === "object" && entry !== null ? Reflect.get(entry, "keel") : undefined;
  if (typeof keel !== "string" || !keel.startsWith("./")) return exportOf(pkg, sub);
  const file = path.resolve(pkg, keel);
  if (!fs.existsSync(file)) return undefined;
  const [real, root] = [fs.realpathSync(file), fs.realpathSync(pkg)];
  return real.startsWith(root + path.sep) ? [real, root] : undefined;
}

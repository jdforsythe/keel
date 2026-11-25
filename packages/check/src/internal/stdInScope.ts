import fs from "node:fs";
import path from "node:path";
import { libraryFiles } from "@keel/compiler/std/libraryFiles";
import type { SourceFile } from "../types/SourceFile.ts";
import { isRecord } from "./compat/isRecord.ts";
import { readManifest } from "./modules/readManifest.ts";
import { parseFile } from "./parseFile.ts";

const MANIFEST = /(?:^|\/)modules\/[^/]+\/module\.[cm]?[jt]s$/;
const KEEL = /^@keel\//;

const readJson = (file: string): unknown => {
  try {
    const v: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
    return v;
  } catch {
    return undefined;
  }
};

/** The folder of package `name` as an import from `dir` finds it: `node_modules/<name>` there or above. */
function packageDir(dir: string, name: string): string | undefined {
  for (let d = dir; ; d = path.dirname(d)) {
    const at = path.join(d, "node_modules", name);
    if (fs.existsSync(path.join(at, "package.json"))) return fs.realpathSync(at);
    if (path.dirname(d) === d) return undefined;
  }
}

/**
 * The `@keel/*` packages a fresh `keel check` of `files` loads (k.check-cache In one process): each name in the `deps`
 * of an app manifest (`modules/<id>/module.ts` at any depth, resolved from its folder), and the `@keel/*` packages
 * their `package.json` `dependencies` and `peerDependencies` name, transitively, and the app's libraries with the
 * `@keel/*` packages theirs name (`libraryFiles`, k.library In an app). A library's formats and rules apply only when
 * it is among them, however long the process has held it. Read from the disk on each call.
 */
export function stdInScope(files: readonly SourceFile[], root: string): ReadonlySet<string> {
  const out = new Set<string>();
  const visit = (dir: string, name: string): void => {
    if (out.has(name)) return;
    out.add(name);
    const at = packageDir(dir, name);
    const pkg = at === undefined ? undefined : readJson(path.join(at, "package.json"));
    if (at === undefined || !isRecord(pkg)) return;
    for (const field of [pkg.dependencies, pkg.peerDependencies])
      if (isRecord(field)) for (const dep of Object.keys(field)) if (KEEL.test(dep)) visit(at, dep);
  };
  for (const f of files) {
    if (!MANIFEST.test(f.path)) continue;
    const parsed = parseFile(f);
    const manifest = parsed.ok ? readManifest(parsed.program) : null;
    if (manifest === null) continue;
    const dir = path.dirname(path.resolve(root, f.path));
    for (const d of manifest.deps.entries) visit(dir, d.value);
  }
  for (const lib of libraryFiles(root, files)) visit(lib.dir, lib.name);
  return out;
}

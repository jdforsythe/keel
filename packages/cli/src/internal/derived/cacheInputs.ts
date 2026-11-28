import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { isRecord } from "../isRecord.ts";
import { realPaths } from "../realPaths.ts";
import type { CacheInput } from "./CacheInput.ts";
import { hashFile } from "./hashFile.ts";

type Pkg = { dir: string; name: string } | undefined;

/**
 * The nearest folder above `file` holding a `package.json` with a `name`, and that name. `seen` holds the answer for
 * each folder already asked in this call, so the files of one package read its `package.json` once.
 */
function packageOf(file: string, seen: Map<string, Pkg>): Pkg {
  const asked: string[] = [];
  let found: Pkg;
  for (let d = dirname(file); dirname(d) !== d; d = dirname(d)) {
    if (seen.has(d)) {
      found = seen.get(d);
      break;
    }
    asked.push(d);
    const pkg = join(d, "package.json");
    if (!existsSync(pkg)) continue;
    let v: unknown;
    try {
      v = JSON.parse(readFileSync(pkg, "utf8"));
    } catch {
      break;
    }
    if (isRecord(v) && typeof v.name === "string") {
      found = { dir: d, name: v.name };
      break;
    }
  }
  for (const d of asked) seen.set(d, found);
  return found;
}

/**
 * The recorded inputs of an evaluation of the project at `root` (a real path), sorted by path: each file it loaded
 * and each file its code or its resolver read (`reads`, kept at the path the code named, so a read through a link is
 * read through it again), project-relative when it is the project's own (under `root`, outside `node_modules`), else
 * `<package name>/<path in the package>` beside that package's `package.json` when that package does not hold the
 * project, else absolute; and `topology.ts`, which selects what is evaluated. A file that cannot be read is no input
 * (`cacheProbes` records it as absent).
 */
export function cacheInputs(root: string, loaded: readonly string[], reads: readonly string[] = []): CacheInput[] {
  const out = new Map<string, CacheInput>();
  const packages = new Map<string, Pkg>();
  const realOf = realPaths();
  const add = (path: string, file: string): void => {
    if (out.has(path)) return;
    const sha256 = hashFile(file);
    if (sha256 !== undefined) out.set(path, { path, file, sha256 });
  };
  const named = (real: string, file: string, outside: boolean): void => {
    const rel = relative(root, real).split(sep).join("/");
    if (!rel.startsWith("../") && !rel.split("/").includes("node_modules")) {
      add(rel, file);
      return;
    }
    const pkg = packageOf(real, packages);
    // A package folder holding the project (a workspace root) is no dependency: its files are named absolute.
    const holds = pkg !== undefined && !relative(pkg.dir, root).startsWith("..");
    if (pkg === undefined || holds) {
      if (outside) add(file, file);
      return;
    }
    add(`${pkg.name}/${relative(pkg.dir, real).split(sep).join("/")}`, file);
    add(`${pkg.name}/package.json`, join(pkg.dir, "package.json"));
  };
  if (existsSync(join(root, "topology.ts"))) add("topology.ts", join(root, "topology.ts"));
  for (const abs of loaded) {
    const file = realOf(abs);
    if (file !== undefined) named(file, file, false);
  }
  for (const file of reads) {
    const real = realOf(file);
    if (real !== undefined) named(real, file, true);
  }
  return [...out.values()].sort((a, b) => (a.path < b.path ? -1 : 1));
}

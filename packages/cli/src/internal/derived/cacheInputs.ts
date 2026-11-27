import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { isRecord } from "../isRecord.ts";
import type { CacheInput } from "./CacheInput.ts";
import { hashFile } from "./hashFile.ts";

/** The nearest folder above `file` holding a `package.json` with a `name`, and that name. */
function packageOf(file: string): { dir: string; name: string } | undefined {
  for (let d = dirname(file); dirname(d) !== d; d = dirname(d)) {
    const pkg = join(d, "package.json");
    if (!existsSync(pkg)) continue;
    let v: unknown;
    try {
      v = JSON.parse(readFileSync(pkg, "utf8"));
    } catch {
      return undefined;
    }
    if (isRecord(v) && typeof v.name === "string") return { dir: d, name: v.name };
  }
  return undefined;
}

/**
 * The recorded inputs of an evaluation of the project at `root` (a real path), sorted by path: each file it loaded
 * and each file its code read (`reads`, kept at the path the code named, so a read through a link is read through it
 * again), project-relative when it is the project's own (under `root`, outside `node_modules`), else `<package
 * name>/<path in the package>` beside that package's `package.json`, else absolute; and `topology.ts`, which selects
 * what is evaluated. A file that cannot be read is no input (`cacheProbes` records it as absent).
 */
export function cacheInputs(root: string, loaded: readonly string[], reads: readonly string[] = []): CacheInput[] {
  const out = new Map<string, CacheInput>();
  const add = (path: string, file: string): void => {
    const sha256 = hashFile(file);
    if (sha256 !== undefined && !out.has(path)) out.set(path, { path, file, sha256 });
  };
  const named = (real: string, file: string, outside: boolean): void => {
    const rel = relative(root, real).split(sep).join("/");
    if (!rel.startsWith("../") && !rel.split("/").includes("node_modules")) {
      add(rel, file);
      return;
    }
    const pkg = packageOf(real);
    if (pkg === undefined) {
      if (outside) add(file, file);
      return;
    }
    add(`${pkg.name}/${relative(pkg.dir, real).split(sep).join("/")}`, file);
    add(`${pkg.name}/package.json`, join(pkg.dir, "package.json"));
  };
  if (existsSync(join(root, "topology.ts"))) add("topology.ts", join(root, "topology.ts"));
  for (const abs of loaded) {
    let file: string;
    try {
      file = realpathSync(abs);
    } catch {
      continue;
    }
    named(file, file, false);
  }
  for (const file of reads) {
    let real: string;
    try {
      real = realpathSync(file);
    } catch {
      continue;
    }
    named(real, file, true);
  }
  return [...out.values()].sort((a, b) => (a.path < b.path ? -1 : 1));
}

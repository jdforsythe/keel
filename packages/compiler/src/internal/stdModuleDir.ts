import fs from "node:fs";
import path from "node:path";
import { appManifest } from "./appManifest.ts";
import { manifestSource } from "./manifestSource.ts";

const STD = /^@keel\/std-[a-z0-9-]+$/;
const MANIFEST = /^module\.[cm]?[jt]s$/;

/** The source of `file`, or undefined when it cannot be read. */
function read(file: string): string | undefined {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return undefined;
  }
}

/** The directory of `node_modules/<dep>` holding a `package.json`, in `dir` or an ancestor; undefined when none. */
function packageDir(dir: string, dep: string): string | undefined {
  for (let d = dir; ; d = path.dirname(d)) {
    const pkg = path.join(d, "node_modules", dep);
    if (fs.existsSync(path.join(pkg, "package.json"))) return pkg;
    if (path.dirname(d) === d) return undefined;
  }
}

/**
 * The package directory of placed stdlib module `id` (k.topology Route table), whatever it exports: with no
 * `modules/<id>/` folder under `root`, the first `@keel/std-*` package in the `deps` of an app manifest
 * `modules/<m>/module.ts` (folders by name, then `deps` order) whose root manifest (its `./module` export) has `id` `id`, as `stdExport`
 * searches. Undefined for an app module or when no such package is found.
 */
export function stdModuleDir(root: string, id: string): string | undefined {
  const modules = path.join(root, "modules");
  if (fs.existsSync(path.join(modules, id)) || !fs.existsSync(modules)) return undefined;
  const folders = fs
    .readdirSync(modules, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
  for (const m of folders) {
    const dir = path.join(modules, m);
    const name = fs.readdirSync(dir).find((f) => MANIFEST.test(f));
    const source = name === undefined ? undefined : read(path.join(dir, name));
    for (const d of (source === undefined ? null : appManifest(source))?.deps ?? []) {
      const pkg = STD.test(d.value) ? packageDir(dir, d.value) : undefined;
      const own = pkg === undefined ? undefined : manifestSource(pkg);
      if (pkg !== undefined && own !== undefined && appManifest(own)?.id === id) return pkg;
    }
  }
  return undefined;
}

import fs from "node:fs";
import path from "node:path";
import { appManifest } from "./appManifest.ts";
import { libraryDir } from "./libraryDir.ts";
import { manifestSource } from "./manifestSource.ts";

const MANIFEST = /^module\.[cm]?[jt]s$/;

/** The source of `file`, or undefined when it cannot be read. */
function read(file: string): string | undefined {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return undefined;
  }
}

/**
 * The package directory of placed stdlib module `id` (k.topology Route table), whatever it exports: with no
 * `modules/<id>/` folder under `root`, the first library (`libraryDir`) in the `deps` of an app manifest
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
      const pkg = libraryDir(dir, d.value);
      const own = pkg === undefined ? undefined : manifestSource(pkg);
      if (pkg !== undefined && own !== undefined && appManifest(own)?.id === id) return pkg;
    }
  }
  return undefined;
}

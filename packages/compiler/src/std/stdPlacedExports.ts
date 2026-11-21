import fs from "node:fs";
import path from "node:path";
import { appManifest } from "../internal/appManifest.ts";
import { exportOf } from "../internal/exportOf.ts";
import { manifestSource } from "../internal/manifestSource.ts";

const STD = /^@keel\/std-[a-z0-9-]+$/;
const MANIFEST = /^modules\/([^/]+)\/module\.[cm]?[jt]s$/;

/** The directory of `node_modules/<dep>` holding a `package.json`, in `dir` or an ancestor; undefined when none. */
function packageDir(dir: string, dep: string): string | undefined {
  for (let d = dir; ; d = path.dirname(d)) {
    const pkg = path.join(d, "node_modules", dep);
    if (fs.existsSync(path.join(pkg, "package.json"))) return pkg;
    if (path.dirname(d) === d) return undefined;
  }
}

/**
 * Which of `./contract` and `./routes` the package of placed stdlib module `id` resolves (k.topology Rules, E1586),
 * from the project's own files (`files`, project-relative paths) and the packages installed under `root`: with no
 * file under `modules/<id>/`, the first `@keel/std-*` package in the `deps` of an app manifest `modules/<m>/module.ts`
 * (folders by name, then `deps` order), found in `node_modules` from `<root>/modules/<m>/` up, whose root manifest has
 * `id` `id`. An export resolves when the package's `exports` names it and the file it names is in the package
 * (`exportOf`). Undefined for an app module or when no such package is found.
 */
export function stdPlacedExports(
  root: string,
  id: string,
  files: readonly { path: string; source: string }[],
): { name: string; contract: boolean; routes: boolean } | undefined {
  if (files.some((f) => f.path.startsWith(`modules/${id}/`))) return undefined;
  const manifests = files
    .flatMap((f) => {
      const m = MANIFEST.exec(f.path)?.[1];
      return m === undefined ? [] : [{ m, source: f.source }];
    })
    .sort((a, b) => (a.m < b.m ? -1 : a.m > b.m ? 1 : 0));
  for (const { m, source } of manifests)
    for (const d of appManifest(source)?.deps ?? []) {
      const pkg = STD.test(d.value) ? packageDir(path.join(root, "modules", m), d.value) : undefined;
      const own = pkg === undefined ? undefined : manifestSource(pkg);
      if (pkg === undefined || own === undefined || appManifest(own)?.id !== id) continue;
      return {
        name: d.value,
        contract: exportOf(pkg, "./contract") !== undefined,
        routes: exportOf(pkg, "./routes") !== undefined,
      };
    }
  return undefined;
}

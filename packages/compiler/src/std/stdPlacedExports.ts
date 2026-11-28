import path from "node:path";
import { appManifest } from "../internal/appManifest.ts";
import { exportOf } from "../internal/exportOf.ts";
import { libraryDir } from "../internal/libraryDir.ts";
import { manifestSource } from "../internal/manifestSource.ts";

const MANIFEST = /^modules\/([^/]+)\/module\.[cm]?[jt]s$/;

/**
 * Which of `./contract` and `./routes` the package of placed stdlib module `id` resolves (k.topology Rules, E1586),
 * from the project's own files (`files`, project-relative paths) and the packages installed under `root`: with no
 * file under `modules/<id>/`, the first library (`libraryDir`) in the `deps` of an app manifest `modules/<m>/module.ts`
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
      const pkg = libraryDir(path.join(root, "modules", m), d.value);
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

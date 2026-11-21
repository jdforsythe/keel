import fs from "node:fs";
import path from "node:path";
import { appManifest } from "./appManifest.ts";
import { entryOf } from "./entryOf.ts";

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

/**
 * Export `sub` (`./routes`, `./contract`) of placed module `id` when it is a stdlib module (k.topology Route table):
 * with no `modules/<id>/` folder under `root`, the first `@keel/std-*` package (app manifests by folder name, then
 * `deps` order) in the `deps` of an app manifest `modules/<m>/module.ts` whose root manifest `module.ts` has `id`
 * `id` and whose `package.json` exports `sub`, resolved from that manifest's folder by Node's `exports` rule. Gives
 * the export's real file, the package's real directory and the import specifier; undefined for an app module, an
 * unknown id, or a package without `sub`.
 */
export function stdExport(
  root: string,
  id: string,
  sub: `./${string}`,
): [file: string, pkg: string, spec: string] | undefined {
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
    const deps = (source === undefined ? null : appManifest(source))?.deps ?? [];
    for (const d of deps) {
      const at = STD.test(d.value) ? entryOf(dir, d.value, sub) : undefined;
      const own = at === undefined ? undefined : read(path.join(at[1], "module.ts"));
      if (at !== undefined && own !== undefined && appManifest(own)?.id === id)
        return [...at, `${d.value}${sub.slice(1)}`];
    }
  }
  return undefined;
}

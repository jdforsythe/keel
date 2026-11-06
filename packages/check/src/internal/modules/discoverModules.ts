import type { Checked } from "../Checked.ts";
import type { ModuleInfo } from "./ModuleInfo.ts";
import { readManifest } from "./readManifest.ts";

const APP = /(?:^|\/)modules\/([^/]+)\/module\.[cm]?[jt]s$/;
const STD = /(?:^|\/)node_modules\/(@keel\/std-[^/]+)\/module\.[cm]?[jt]s$/;

/**
 * Every module manifest among the checked files, sorted by key then path: app modules at `modules/<id>/module.ts`
 * (key and prefix: the folder id) and stdlib modules at `node_modules/@keel/std-x/module.ts` (key: the package
 * name; prefix: the manifest's `id`, else the package name). The first manifest of a key wins.
 */
export function discoverModules(files: readonly Checked[]): ModuleInfo[] {
  const out: ModuleInfo[] = [];
  for (const { file, parsed } of files) {
    const app = APP.exec(file.path);
    const std = app === null ? STD.exec(file.path) : null;
    const key = app?.[1] ?? std?.[1];
    if (key === undefined) continue;
    const manifest = readManifest(parsed.program);
    const prefix = app === null ? (manifest?.id ?? key) : key;
    const root = file.path.slice(0, file.path.lastIndexOf("/") + 1);
    out.push({ key, prefix, root, file, manifest });
  }
  out.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : a.root < b.root ? -1 : a.root > b.root ? 1 : 0));
  return out.filter((m, i) => out[i - 1]?.key !== m.key);
}

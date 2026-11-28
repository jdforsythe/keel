import { libraryKind } from "@keel/compiler/std/libraryKind";
import type { SourceFile } from "../../types/SourceFile.ts";
import type { Checked } from "../Checked.ts";
import type { ModuleInfo } from "./ModuleInfo.ts";
import { readManifest } from "./readManifest.ts";

const APP = /(?:^|\/)modules\/([^/]+)\/module\.[cm]?[jt]s$/;
const PACKAGE = /(?:^|\/)node_modules\/(@[^/]+\/[^/]+)\/module\.[cm]?[jt]s$/;

/** The parsed JSON of `source`; undefined when there is none or it does not parse. */
function parse(source: string | undefined): unknown {
  if (source === undefined) return undefined;
  try {
    const v: unknown = JSON.parse(source);
    return v;
  } catch {
    return undefined;
  }
}

/** The subpaths of a `package.json` `exports` object written whole, other than `.`, with no `./` (`./server` -> `server`). */
function entriesOf(pkg: unknown): ReadonlySet<string> {
  if (typeof pkg !== "object" || pkg === null || !("exports" in pkg)) return new Set();
  const exp = pkg.exports;
  if (typeof exp !== "object" || exp === null) return new Set();
  return new Set(
    Object.keys(exp)
      .filter((k) => k.startsWith("./") && k !== "./" && !k.includes("*"))
      .map((k) => k.slice(2)),
  );
}

/**
 * Every module manifest among the checked files, sorted by key then path: app modules at `modules/<id>/module.ts`
 * (key and prefix: the folder id) and libraries' root manifests at `node_modules/<name>/module.ts` (k.library Kind;
 * key: the package name; prefix: the manifest's `id`, else the package name). A package is a library when its
 * `package.json` beside the manifest, read from `files`, makes it one (`libraryKind`); a `@keel/std-*` package is one by
 * its name. The first manifest of a key wins.
 */
export function discoverModules(checked: readonly Checked[], files: readonly SourceFile[]): ModuleInfo[] {
  const out: ModuleInfo[] = [];
  for (const { file, parsed } of checked) {
    const app = APP.exec(file.path);
    const name = app === null ? PACKAGE.exec(file.path)?.[1] : undefined;
    const root = file.path.slice(0, file.path.lastIndexOf("/") + 1);
    const pkg = name === undefined ? undefined : files.find((f) => f.path === `${root}package.json`)?.source;
    const json = parse(pkg);
    const library = name !== undefined && libraryKind(json, name) !== undefined;
    const key = app?.[1] ?? (library ? name : undefined);
    if (key === undefined) continue;
    const manifest = readManifest(parsed.program);
    const prefix = app === null ? (manifest?.id ?? key) : key;
    out.push({ key, prefix, root, file, manifest, library, entries: entriesOf(json) });
  }
  out.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : a.root < b.root ? -1 : a.root > b.root ? 1 : 0));
  return out.filter((m, i) => out[i - 1]?.key !== m.key);
}

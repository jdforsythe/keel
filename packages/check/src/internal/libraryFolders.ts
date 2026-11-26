import { libraryKind } from "@keel/compiler/std/libraryKind";
import type { SourceFile } from "../types/SourceFile.ts";
import type { LibraryContract } from "./LibraryContract.ts";
import type { LibraryView } from "./LibraryView.ts";
import { entryTarget } from "./entryTarget.ts";
import { readManifest } from "./modules/readManifest.ts";
import { parseFile } from "./parseFile.ts";

const PACKAGE = /^((?:(?!node_modules\/).)*?)node_modules\/(@[^/]+\/[^/]+)\/package\.json$/;
/** A library's contract file: a `*.contract.ts` source under `src/` (k.contract). */
const CONTRACT_FILE = /^src\/(?:[^/]+\/)*[^/]+\.contract\.ts$/;
/** The app module folder a path lies in, `<p>modules/<id>/`. */
const APP_FOLDER = /^(?:(?!node_modules\/).)*?modules\/[^/]+\//;
const FILE = /^((?:(?!node_modules\/).)*?)node_modules\/(@[^/]+\/[^/]+)\/((?:src|unsafe)\/.+)$/;

/** The parsed JSON of `source`; undefined when it does not parse. */
function parse(source: string): unknown {
  try {
    const v: unknown = JSON.parse(source);
    return v;
  } catch {
    return undefined;
  }
}

/**
 * The library files among `files` and the paths rules read them at (`LibraryView`). A library is a
 * `<p>node_modules/<name>/package.json` that `libraryKind` reads as `library`, `<p>` holding no `node_modules/`, beside a
 * `module.ts` whose literal `id` names the folder its files read under (the package name without one). A library file
 * whose view is the path of a file of `files` keeps its own path, and so does every file of a library whose `id` an app
 * module of `files` holds, or a library before it by package name (E1166): no file of it is read as the holder's.
 */
export function libraryFolders(files: readonly SourceFile[]): LibraryView {
  const ids = new Map<string, string>();
  const packages: SourceFile[] = [];
  const entries = new Map<string, string>();
  const contracts = new Map<string, LibraryContract>();
  const manifests: SourceFile[] = [];
  const byPath = new Map(files.map((f) => [f.path, f]));
  // Each app module folder (`<p>modules/<id>/`) a file lies in: a library holding that id is not read under it.
  const held = new Set<string>();
  for (const f of files) {
    const at = APP_FOLDER.exec(f.path)?.[0];
    if (at !== undefined && !f.path.includes("node_modules/")) held.add(at);
  }
  // By package name, so of two libraries holding one id the first by name is read under it (E1166's order).
  const found = files
    .map((f) => ({ f, m: PACKAGE.exec(f.path) }))
    .filter((x): x is { f: SourceFile; m: RegExpExecArray } => x.m !== null)
    .sort((a, b) => (a.f.path < b.f.path ? -1 : a.f.path > b.f.path ? 1 : 0));
  for (const { f, m } of found) {
    const [, prefix = "", name = ""] = m;
    if (libraryKind(parse(f.source), name) !== "library") continue;
    const manifest = byPath.get(`${prefix}node_modules/${name}/module.ts`);
    if (manifest === undefined) continue;
    const parsed = parseFile(manifest);
    const id = parsed.ok ? readManifest(parsed.program)?.id : undefined;
    const under = `${prefix}modules/${id ?? name}/`;
    packages.push(f);
    // E1166 (k.library): a library whose id an app module or a library read before it holds keeps its files where they lie.
    if (held.has(under)) continue;
    held.add(under);
    ids.set(`${prefix}node_modules/${name}/`, under);
    const exports = Reflect.get(Object(parse(f.source)), "exports");
    const sugar =
      typeof exports === "string" ||
      (typeof exports === "object" && exports !== null && !Object.keys(exports).some((k) => k.startsWith(".")));
    const map = sugar ? { ".": exports } : exports;
    for (const [key, target] of Object.entries(typeof map === "object" && map !== null ? map : {})) {
      const rel = (entryTarget(target) ?? "").replace(/^\.\//, "");
      if (key.startsWith(".") && !key.includes("*") && /^(?:src|unsafe)\//.test(rel))
        entries.set(`${name}${key.slice(1)}`, `${under}${rel}`);
    }
    const declared = typeof map === "object" && map !== null ? Reflect.get(map, "./contract") : undefined;
    const target = declared === undefined ? undefined : (entryTarget(declared) ?? "").replace(/^\.\//, "");
    const file = target !== undefined && CONTRACT_FILE.test(target) ? `${under}${target}` : undefined;
    contracts.set(under, { target, file });
    if (!byPath.has(`${under}module.ts`)) manifests.push({ path: `${under}module.ts`, source: manifest.source });
  }
  const toView = new Map<string, string>();
  const toReal = new Map<string, string>();
  const folders = new Map<string, string>();
  if (ids.size > 0)
    for (const f of files) {
      const m = FILE.exec(f.path);
      if (m === null) continue;
      const [, prefix = "", name = "", rest = ""] = m;
      const folder = `${prefix}node_modules/${name}/`;
      const under = ids.get(folder);
      if (under === undefined || byPath.has(`${under}${rest}`)) continue;
      toView.set(f.path, `${under}${rest}`);
      toReal.set(`${under}${rest}`, f.path);
      folders.set(f.path, folder);
    }
  return {
    view: (p) => toView.get(p) ?? p,
    real: (p) => toReal.get(p) ?? p,
    folder: (p) => folders.get(p),
    packages,
    entries,
    contracts,
    manifests,
  };
}

import { libraryKind } from "./std/libraryKind.ts";
import type { SourceFile } from "./types/SourceFile.ts";

const TOPOLOGY = /^((?:.*\/)?)topology\.ts$/;
const ARTIFACT = /^((?:.*\/)?)\.keel\/[^/]+\.json$/;
const MANIFEST = /^((?:.*\/)?)package\.json$/;
const DEFAULT_EXPORT = /^\s*export\s+default\b/m;

/** The parsed JSON of `source`; undefined when it does not parse. */
function parse(source: string): unknown {
  try {
    const v: unknown = JSON.parse(source);
    return v;
  } catch {
    return undefined;
  }
}

/** True when `pkg`, a parsed `package.json`, marks its folder a library (k.library Kind). */
function marksLibrary(pkg: unknown): boolean {
  const name = typeof pkg === "object" && pkg !== null ? Reflect.get(pkg, "name") : undefined;
  return typeof name === "string" && libraryKind(pkg, name) === "library";
}

/**
 * The project roots among root-relative `files`, deepest first so the first prefix match is a file's own project:
 * `""` and each dir holding a `.keel/` artifact or a `topology.ts` with a default export, readable or not (a file
 * of that name with none, a library's own source, is not a topology), unless the dir has a `modules` or `node_modules`
 * segment or lies in a folder below the root whose `package.json` marks it a library: module code and a library
 * (k.library) are never a project root, so a `topology.ts` under `modules/` cannot move files out of their module, nor
 * a library's `.keel/ledger.json` its files out of the app. The one rule `check()` (one compile per project) and
 * `keel build` (only the root project's files) share.
 */
export function projectDirs(files: readonly SourceFile[]): string[] {
  const libraries: string[] = [];
  for (const f of files) {
    const dir = MANIFEST.exec(f.path)?.[1];
    if (dir !== undefined && dir !== "" && marksLibrary(parse(f.source))) libraries.push(dir);
  }
  const dirs = new Set<string>([""]);
  for (const f of files) {
    const top = TOPOLOGY.exec(f.path)?.[1];
    const dir = top !== undefined && DEFAULT_EXPORT.test(f.source) ? top : ARTIFACT.exec(f.path)?.[1];
    if (dir === undefined || dir.split("/").some((s) => s === "modules" || s === "node_modules")) continue;
    if (!libraries.some((l) => dir.startsWith(l))) dirs.add(dir);
  }
  return [...dirs].sort((a, b) => b.length - a.length || (a < b ? -1 : 1));
}

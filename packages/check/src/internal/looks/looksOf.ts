import { libraryKind } from "@keel/compiler/std/libraryKind";
import type { SourceFile } from "../../types/SourceFile.ts";
import type { Entry } from "../modules/Entry.ts";
import { readManifest } from "../modules/readManifest.ts";
import { parseFile } from "../parseFile.ts";
import type { LookLibrary } from "./LookLibrary.ts";
import type { Looks } from "./Looks.ts";
import { readShipped } from "./readShipped.ts";

const PACKAGE = /^node_modules\/(@[^/]+\/[^/]+)\/package\.json$/;
const APP_MANIFEST = /^modules\/[^/]+\/module\.ts$/;

/** The parsed JSON of `source`; undefined when it does not parse. */
function json(source: string): unknown {
  try {
    const v: unknown = JSON.parse(source);
    return v;
  } catch {
    return undefined;
  }
}

/** A path relative to `dir`, a leading `./` dropped; undefined for a path outside it. */
const under = (dir: string, path: string): string | undefined => {
  const p = path.replace(/^\.\//, "");
  return p.startsWith(dir) ? p.slice(dir.length) : undefined;
};

/** The manifest of the `module.ts` at `path` (`id` and `deps`), or null. */
function manifestAt(byRel: ReadonlyMap<string, SourceFile>, rel: string) {
  const f = byRel.get(rel);
  if (f === undefined) return null;
  const parsed = parseFile(f);
  return parsed.ok ? readManifest(parsed.program) : null;
}

/**
 * k.looks over the project at `dir` (real paths): each library in its `node_modules/<name>/` (a `package.json` that
 * `libraryKind` reads as `library`, beside a `module.ts` with a literal `id`), and, when `dir`'s own `package.json` is
 * a library's, that library as the own one (its files in `node_modules/<name>/` when the folder is read as installed,
 * else at the root). Its `./tokens` entry is judged and its shipped file read as text (`readShipped`).
 */
export function looksOf(files: readonly SourceFile[], dir: string): Looks {
  const byRel = new Map<string, SourceFile>();
  for (const f of files) {
    const rel = under(dir, f.path);
    if (rel !== undefined && !byRel.has(rel)) byRel.set(rel, f);
  }
  const library = (name: string, folder: string, pkgRel: string, own: boolean): LookLibrary | undefined => {
    const pkgFile = byRel.get(pkgRel);
    const pkg = pkgFile === undefined ? undefined : json(pkgFile.source);
    if (pkgFile === undefined || libraryKind(pkg, name) !== "library") return undefined;
    const manifest = manifestAt(byRel, `${folder}module.ts`);
    const id = manifest?.id;
    if (typeof id !== "string") return undefined;
    const exportsMap: unknown = typeof pkg === "object" && pkg !== null ? Reflect.get(pkg, "exports") : undefined;
    const target: unknown =
      typeof exportsMap === "object" && exportsMap !== null ? Reflect.get(exportsMap, "./tokens") : undefined;
    const keel: unknown =
      typeof target === "string"
        ? target
        : typeof target === "object" && target !== null
          ? Reflect.get(target, "keel")
          : undefined;
    const want = `./src/${id}Tokens.ts`;
    const entry = target === undefined ? "none" : keel === want ? "ok" : "wrong";
    const shippedRel = `${folder}src/${id}Tokens.ts`;
    const shippedFile = entry === "ok" ? byRel.get(shippedRel) : undefined;
    const parsed = shippedFile === undefined ? undefined : parseFile(shippedFile);
    const shipped = parsed?.ok === true ? readShipped(parsed.program, id) : null;
    return {
      name,
      id,
      folder: `${dir}${folder}`,
      own,
      packagePath: pkgFile.path,
      entry,
      exportsAt: Math.max(0, pkgFile.source.indexOf('"exports"')),
      shippedPath: shippedFile?.path ?? `${dir}${shippedRel}`,
      shipped,
    };
  };
  const libraries: LookLibrary[] = [];
  for (const rel of byRel.keys()) {
    const m = PACKAGE.exec(rel);
    const name = m?.[1];
    if (name === undefined) continue;
    const lib = library(name, `node_modules/${name}/`, rel, false);
    if (lib !== undefined) libraries.push(lib);
  }
  // The own folder (k.library-pack Own folder): read as installed, or with its files at the root.
  const rootPkg = byRel.get("package.json");
  const rootName: unknown = rootPkg === undefined ? undefined : Reflect.get(Object(json(rootPkg.source)), "name");
  let own: LookLibrary | undefined;
  if (typeof rootName === "string") {
    const installed = libraries.findIndex((l) => l.name === rootName);
    const at = installed >= 0 ? libraries[installed] : undefined;
    own =
      at === undefined
        ? library(rootName, "", "package.json", true)
        : library(rootName, `node_modules/${rootName}/`, `node_modules/${rootName}/package.json`, true);
    if (own !== undefined && installed >= 0) libraries.splice(installed, 1, own);
    else if (own !== undefined) libraries.push(own);
  }
  const entries = new Map<string, { path: string; entry: Entry }[]>();
  const listedNames = new Set<string>();
  const list = (rel: string): void => {
    const deps = manifestAt(byRel, rel)?.deps.entries ?? [];
    const path = byRel.get(rel)?.path ?? rel;
    for (const entry of deps) {
      listedNames.add(entry.value);
      entries.set(entry.value, [...(entries.get(entry.value) ?? []), { path, entry }]);
    }
  };
  if (own !== undefined) list(`${own.folder.slice(dir.length)}module.ts`);
  else for (const rel of byRel.keys()) if (APP_MANIFEST.test(rel)) list(rel);
  const listed = libraries.filter((l) => l.own || listedNames.has(l.name));
  const libraryOf = (realPath: string): LookLibrary | undefined => {
    const rel = under(dir, realPath);
    if (rel === undefined) return undefined;
    return libraries.find((l) => {
      const folder = l.folder.slice(dir.length);
      return rel.startsWith(`${folder}src/`) || rel.startsWith(`${folder}unsafe/`);
    });
  };
  return { dir, libraries, listed, entries, own, libraryOf };
}

import path from "node:path";
import { pathToFileURL } from "node:url";
import { appManifest } from "../internal/appManifest.ts";
import { exportOf } from "../internal/exportOf.ts";
import { lineCol } from "../internal/lineCol.ts";
import { packageDir } from "../internal/packageDir.ts";
import { readJson } from "../internal/readJson.ts";
import { stdImportsNow } from "../internal/stdImportsNow.ts";
import type { Diagnostic } from "../types/Diagnostic.ts";
import type { SourceFile } from "../types/SourceFile.ts";
import { libraryFiles } from "./libraryFiles.ts";
import { libraryKind } from "./libraryKind.ts";

const MANIFEST = /(?:^|\/)modules\/([^/]+)\/module\.[cm]?[jt]s$/;
/** A `@keel/std-*` entry is imported only when it matches `NAME`, any other package entry only when it is `SCOPED`. */
const STD = /^@keel\/std-/;
const NAME = /^@keel\/std-[a-z0-9-]+$/;
const SCOPED = /^@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/;
const clip = (x: string): string => (x.length > 28 ? `${x.slice(0, 25)}...` : x);
/** Entry files imported in this process; only successes are kept, so a failure is retried on the next call. */
const loaded = new Set<string>();

/** Import `file` of package `dep` once per process: true when it is loaded, false when it throws. */
async function once(dep: string, file: string): Promise<boolean> {
  if (loaded.has(file)) return true;
  stdImportsNow.add(dep);
  try {
    await import(pathToFileURL(file).href);
  } catch {
    return false;
  } finally {
    stdImportsNow.delete(dep);
  }
  loaded.add(file);
  return true;
}

/** The `./tools` target `pkg`'s `package.json` declares (`exports["./tools"]`, by Node's conditions), whether or not it exists. */
function toolsTarget(pkg: string): string | undefined {
  const exp = Reflect.get(Object(readJson(path.join(pkg, "package.json"))), "exports");
  const tools = typeof exp === "object" && exp !== null ? Reflect.get(exp, "./tools") : undefined;
  if (typeof tools === "string") return tools;
  if (typeof tools !== "object" || tools === null) return undefined;
  for (const k of ["node", "import", "default"]) {
    const t = Reflect.get(tools, k);
    if (typeof t === "string") return t;
  }
  return undefined;
}

/**
 * Import package `dep`, as seen from `dir`: undefined once loaded, else why not (a library's `./tools` that does not
 * import: the target it declares). A package of kind `library` is
 * imported only through its `./tools` export, when it declares one, and never through its entry: the check reads its
 * components from source (k.library-pack Package). An unmarked `@keel/std-*` package (kind `std`) imports its entry,
 * if any, then its `./tools`.
 */
async function load(dir: string, dep: string): Promise<string | { readonly tools: string } | undefined> {
  if (STD.test(dep) && !NAME.test(dep)) return "not @keel/std-[a-z0-9-]+";
  if (!SCOPED.test(dep)) return "not a scoped package name";
  const pkg = packageDir(dir, dep);
  if (pkg === undefined) return "not found";
  const kind = libraryKind(readJson(path.join(pkg, "package.json")), dep);
  if (kind === undefined) return "not a library";
  const tools = exportOf(pkg, "./tools")?.[0];
  if (kind === "library") {
    const declared = toolsTarget(pkg);
    if (declared === undefined) return undefined;
    return tools !== undefined && (await once(dep, tools)) ? undefined : { tools: declared };
  }
  const file = exportOf(pkg)?.[0];
  if (file === undefined && tools === undefined) return "not found";
  if (file !== undefined && !(await once(dep, file))) return "throws on import";
  return tools === undefined || (await once(dep, tools)) ? undefined : "tools throws on import";
}

/**
 * Import each library of the app (k.library In an app, k.module Std config): every `@` entry in the `deps` of an app
 * manifest (`modules/<id>/module.ts`, at any depth of `files`; paths relative to `root` or absolute), resolved as an
 * ESM import from the manifest's folder through its own and its ancestors' `node_modules` (the project's dependencies:
 * the trust level of `vite dev`), and every `@` entry of a found library's root manifest, resolved from the library's
 * real folder. Each is imported once, so its check rules, formats and config schema register before anything validates
 * (`keel check` on every surface, `keel build`, the Vite plugin): a library (kind `library`) only through its `./tools`
 * export, when it declares one, never its entry; an unmarked `@keel/std-*` package its entry if it has one and its
 * `./tools` if it has one (`load`). A `@keel/std-*` name not matching `@keel/std-[a-z0-9-]+`, another name that is not
 * a scoped package name, a package not found, one that is no library (`libraryKind`), a stdlib package with neither an
 * entry nor a `./tools` export or one that throws while it loads, or a library's declared `./tools` that does not
 * import (message `<name> ./tools <target> does not import; build it`) is E1159 at its `deps` entry (in a library's manifest, located at
 * `node_modules/<name>/module.ts`); the others still load. An entry that does not begin with `@` is a module id and is
 * not imported. A loaded file is not imported again in this process; a failure is retried on the next call. A package
 * that threw, or changed after it loaded, stays as Node's module cache holds it until the process restarts. While a
 * package's file is imported, `stdImporting` names it. Manifests that are not literal are skipped (`keel check` reads
 * them as opaque).
 */
export async function importDeps(root: string, files: readonly SourceFile[]): Promise<Diagnostic[]> {
  const out: Diagnostic[] = [];
  const report = async (dir: string, dep: string, at: string, source: string, start: number, by: string) => {
    const why = await load(dir, dep);
    if (why === undefined) return;
    const kind = STD.test(dep) ? "stdlib" : "library";
    const message =
      typeof why === "string"
        ? `${kind} dep ${clip(dep)} of module ${clip(by)} cannot be imported (${why})`
        : `${clip(dep)} ./tools ${clip(why.tools)} does not import; build it`;
    out.push({ code: "E1159", path: at, ...lineCol(source, start), message, see: "k.module" });
  };
  for (const f of files) {
    const id = MANIFEST.exec(f.path)?.[1];
    const m = id === undefined ? null : appManifest(f.source);
    if (id === undefined || m === null) continue;
    const dir = path.dirname(path.resolve(root, f.path));
    for (const d of m.deps) if (d.value.startsWith("@")) await report(dir, d.value, f.path, f.source, d.start, id);
  }
  for (const lib of libraryFiles(root, files)) {
    const source = lib.manifest ?? "";
    const at = `node_modules/${lib.name}/module.ts`;
    for (const d of appManifest(source)?.deps ?? [])
      if (d.value.startsWith("@")) await report(lib.dir, d.value, at, source, d.start, lib.id ?? lib.name);
  }
  return out;
}

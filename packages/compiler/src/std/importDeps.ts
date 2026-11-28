import fs from "node:fs";
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
/** The text of `file`, or "" when it cannot be read. */
function readText(file: string): string {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}
const clip = (x: string): string => (x.length > 28 ? `${x.slice(0, 25)}...` : x);
/** Entry files imported in this process; only successes are kept, so a failure is retried on the next call. */
const loaded = new Set<string>();

/** The E1753 a throw carries (a rule code two packages register, k.check), its message without the code; else undefined. */
function e1753(e: unknown): string | undefined {
  const text = e instanceof Error ? e.message : "";
  return text.startsWith("E1753 ") ? text.slice("E1753 ".length) : undefined;
}

/**
 * Import `file` of package `dep` once per process: true when it is loaded, false when it throws, and the E1753 message
 * when it throws registering a rule code another package holds.
 */
async function once(dep: string, file: string): Promise<boolean | { readonly e1753: string }> {
  if (loaded.has(file)) return true;
  stdImportsNow.add(dep);
  try {
    await import(pathToFileURL(file).href);
  } catch (e) {
    const clash = e1753(e);
    return clash === undefined ? false : { e1753: clash };
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
 * Why a package did not load: a reason (E1159), a library's `./tools` target that does not import (E1159), or the
 * E1753 message of a rule code another package registers; undefined once loaded.
 */
type Why = string | { readonly tools: string } | { readonly e1753: string } | undefined;

/**
 * Import package `dep`, as seen from `dir`: undefined once loaded, else why not (a library's `./tools` that does not
 * import: the target it declares). A package of kind `library` is
 * imported only through its `./tools` export, when it declares one, and never through its entry: the check reads its
 * components from source (k.library-pack Package). An unmarked `@keel/std-*` package (kind `std`) imports its entry,
 * if any, then its `./tools`.
 */
async function load(dir: string, dep: string): Promise<Why> {
  if (STD.test(dep) && !NAME.test(dep)) return "not @keel/std-[a-z0-9-]+";
  if (!SCOPED.test(dep)) return "not a scoped package name";
  return loadAt(packageDir(dir, dep), dep);
}

/** `load` for the package folder `pkg` already found (undefined: not found). */
async function loadAt(pkg: string | undefined, dep: string): Promise<Why> {
  if (pkg === undefined) return "not found";
  const kind = libraryKind(readJson(path.join(pkg, "package.json")), dep);
  if (kind === undefined) return "not a library";
  const tools = exportOf(pkg, "./tools")?.[0];
  if (kind === "library") {
    const declared = toolsTarget(pkg);
    if (declared === undefined) return undefined;
    const done = tools === undefined ? false : await once(dep, tools);
    return done === true ? undefined : done === false ? { tools: declared } : done;
  }
  const file = exportOf(pkg)?.[0];
  if (file === undefined && tools === undefined) return "not found";
  const entry = file === undefined ? true : await once(dep, file);
  if (entry !== true) return entry === false ? "throws on import" : entry;
  const done = tools === undefined ? true : await once(dep, tools);
  return done === true ? undefined : done === false ? "tools throws on import" : done;
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
 * import (message `<name> ./tools <target> does not import; build it`) is E1159 at its `deps` entry, and a `./tools` or
 * entry that throws registering a rule code another package holds is E1753 there (`rule code <code> is registered by
 * <a> and <b>`, k.check), (in a library's manifest, located at
 * `node_modules/<name>/module.ts`); the others still load. An entry that does not begin with `@` is a module id and is
 * not imported. A loaded file is not imported again in this process; a failure is retried on the next call. A package
 * that threw, or changed after it loaded, stays as Node's module cache holds it until the process restarts. While a
 * package's file is imported, `stdImporting` names it. Manifests that are not literal are skipped (`keel check` reads
 * them as opaque). `own` names the library whose own folder `root` is (k.library-pack Own folder): its own `./tools`
 * is imported first, as for an app whose manifest lists it, and one that does not import is that E1159 at
 * `package.json`'s `"./tools"` key.
 */
export async function importDeps(root: string, files: readonly SourceFile[], own?: string): Promise<Diagnostic[]> {
  const out: Diagnostic[] = [];
  if (own !== undefined) {
    const why = await loadAt(root, own);
    if (typeof why === "object" && "e1753" in why)
      out.push({ code: "E1753", path: "package.json", line: 1, col: 1, message: why.e1753, see: "k.check" });
    else if (typeof why === "object") {
      const source = readText(path.join(root, "package.json"));
      const key = source.indexOf('"./tools"');
      const message = `${clip(own)} ./tools ${clip(why.tools)} does not import; build it`;
      out.push({ code: "E1159", path: "package.json", ...lineCol(source, Math.max(key, 0)), message, see: "k.module" });
    }
  }
  const report = async (dir: string, dep: string, at: string, source: string, start: number, by: string) => {
    const why = await load(dir, dep);
    if (why === undefined) return;
    if (typeof why === "object" && "e1753" in why) {
      out.push({ code: "E1753", path: at, ...lineCol(source, start), message: why.e1753, see: "k.check" });
      return;
    }
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

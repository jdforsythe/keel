import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { appManifest } from "../internal/appManifest.ts";
import { lineCol } from "../internal/lineCol.ts";
import type { Diagnostic } from "../types/Diagnostic.ts";
import type { SourceFile } from "../types/SourceFile.ts";

const MANIFEST = /(?:^|\/)modules\/([^/]+)\/module\.[cm]?[jt]s$/;
/** Deps that name a stdlib package; only `NAME` ones are imported (backlog 0194). */
const STD = /^@keel\/std-/;
const NAME = /^@keel\/std-[a-z0-9-]+$/;
const CONDITIONS = ["node", "import", "default"];
const clip = (x: string): string => (x.length > 28 ? `${x.slice(0, 25)}...` : x);
/** Entry files imported in this process; only successes are kept, so a failure is retried on the next call. */
const loaded = new Set<string>();

/** The `exports` target for the ESM conditions `node`, `import`, `default` (the `.` entry of a subpath map). */
function target(x: unknown): string | undefined {
  if (typeof x === "string") return x;
  if (Array.isArray(x)) return x.map(target).find((t) => t !== undefined);
  if (typeof x !== "object" || x === null) return undefined;
  const keys = Object.keys(x);
  if (keys.some((k) => k.startsWith("."))) return target(Reflect.get(x, "."));
  for (const k of keys) {
    const t = CONDITIONS.includes(k) ? target(Reflect.get(x, k)) : undefined;
    if (t !== undefined) return t;
  }
  return undefined;
}

/** A field of a parsed `package.json`. */
const field = (manifest: unknown, k: string): unknown =>
  typeof manifest === "object" && manifest !== null ? Reflect.get(manifest, k) : undefined;

/**
 * The real entry file of `dep` as an ESM import from `dir` sees it: the first `node_modules/<dep>/package.json` in
 * `dir` or an ancestor (no NODE_PATH, no global folders), then its `exports` by ESM conditions, else `main`, else
 * `index.js`. Undefined when there is none.
 */
function entryOf(dir: string, dep: string, sub = "."): string | undefined {
  for (let d = dir; ; d = path.dirname(d)) {
    const pkg = path.join(d, "node_modules", dep);
    const json = path.join(pkg, "package.json");
    if (fs.existsSync(json)) {
      let manifest: unknown;
      try {
        manifest = JSON.parse(fs.readFileSync(json, "utf8"));
      } catch {
        return undefined;
      }
      const exp = field(manifest, "exports");
      const main = field(manifest, "main");
      const rel =
        sub !== "."
          ? target(field(exp, sub))
          : exp === undefined
            ? typeof main === "string"
              ? main
              : "index.js"
            : target(exp);
      const file = rel === undefined ? undefined : path.resolve(pkg, rel);
      return file !== undefined && fs.existsSync(file) ? fs.realpathSync(file) : undefined;
    }
    if (path.dirname(d) === d) return undefined;
  }
}

/** Import `file` once per process: true when it is loaded, false when it throws. */
async function once(file: string): Promise<boolean> {
  if (loaded.has(file)) return true;
  try {
    await import(pathToFileURL(file).href);
  } catch {
    return false;
  }
  loaded.add(file);
  return true;
}

/** Import `dep` (then its `./tools` export, if any) as seen from `dir`: undefined once loaded, else why not. */
async function load(dir: string, dep: string): Promise<string | undefined> {
  if (!NAME.test(dep)) return "not @keel/std-[a-z0-9-]+";
  const file = entryOf(dir, dep);
  if (file === undefined) return "not found";
  if (!(await once(file))) return "throws on import";
  const tools = entryOf(dir, dep, "./tools");
  return tools === undefined || (await once(tools)) ? undefined : "tools throws on import";
}

/**
 * Import each `@keel/std-*` package in the `deps` of every app manifest (and its `./tools` export, if any) (`modules/<id>/module.ts`, at any depth of
 * `files`; paths relative to `root` or absolute) so its check rules and config schema register before anything
 * validates (k.module Std config, rfc:0066; `keel check` on every surface, `keel build`, the Vite plugin). Only names
 * matching `@keel/std-[a-z0-9-]+` are imported, resolved as an ESM import from the manifest's folder through its own
 * and its ancestors' `node_modules` (the project's dependencies: the trust level of `vite dev`, backlog 0194). A name
 * outside that rule, a package not found, or one that throws while it loads is E1159 at its `deps` entry; the others
 * still load. A loaded entry is not imported again in this process; a failure is retried on the next call. A package
 * that threw, or changed after it loaded, stays as Node's module cache holds it until the process restarts.
 * Manifests that are not literal are skipped (`keel check` reads them as opaque).
 */
export async function importDeps(root: string, files: readonly SourceFile[]): Promise<Diagnostic[]> {
  const out: Diagnostic[] = [];
  for (const f of files) {
    const id = MANIFEST.exec(f.path)?.[1];
    const m = id === undefined ? null : appManifest(f.source);
    if (id === undefined || m === null) continue;
    for (const d of m.deps) {
      if (!STD.test(d.value)) continue;
      const why = await load(path.dirname(path.resolve(root, f.path)), d.value);
      if (why === undefined) continue;
      const message = `stdlib dep ${clip(d.value)} of module ${clip(id)} cannot be imported (${why})`;
      out.push({ code: "E1159", path: f.path, ...lineCol(f.source, d.start), message, see: "k.module" });
    }
  }
  return out;
}

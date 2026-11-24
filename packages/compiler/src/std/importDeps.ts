import path from "node:path";
import { pathToFileURL } from "node:url";
import { appManifest } from "../internal/appManifest.ts";
import { entryOf } from "../internal/entryOf.ts";
import { lineCol } from "../internal/lineCol.ts";
import { stdImportsNow } from "../internal/stdImportsNow.ts";
import type { Diagnostic } from "../types/Diagnostic.ts";
import type { SourceFile } from "../types/SourceFile.ts";

const MANIFEST = /(?:^|\/)modules\/([^/]+)\/module\.[cm]?[jt]s$/;
/** Deps that name a stdlib package; only `NAME` ones are imported (backlog 0194). */
const STD = /^@keel\/std-/;
const NAME = /^@keel\/std-[a-z0-9-]+$/;
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

/** Import `dep`'s entry, if any, then its `./tools` export, if any, as seen from `dir`: undefined once loaded. */
async function load(dir: string, dep: string): Promise<string | undefined> {
  if (!NAME.test(dep)) return "not @keel/std-[a-z0-9-]+";
  const file = entryOf(dir, dep)?.[0];
  const tools = entryOf(dir, dep, "./tools")?.[0];
  if (file === undefined && tools === undefined) return "not found";
  if (file !== undefined && !(await once(dep, file))) return "throws on import";
  return tools === undefined || (await once(dep, tools)) ? undefined : "tools throws on import";
}

/**
 * Import each `@keel/std-*` package in the `deps` of every app manifest (`modules/<id>/module.ts`, at any depth of
 * `files`; paths relative to `root` or absolute), its entry if it has one and its `./tools` export if it has one, so
 * its check rules and config schema register before anything validates (k.module Std config, rfc:0066; `keel check`
 * on every surface, `keel build`, the Vite plugin). Only names matching `@keel/std-[a-z0-9-]+` are imported, resolved
 * as an ESM import from the manifest's folder through its own and its ancestors' `node_modules` (the project's
 * dependencies: the trust level of `vite dev`, backlog 0194). A name outside that rule, a package not found or with
 * neither an entry nor a `./tools` export, or one that throws while it loads is E1159 at its `deps` entry; the others
 * still load. A loaded file is not imported again in this process; a failure is retried on the next call. A package
 * that threw, or changed after it loaded, stays as Node's module cache holds it until the process restarts. While a
 * package's file is imported, `stdImporting` names it. Manifests that are not literal are skipped (`keel check`
 * reads them as opaque).
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

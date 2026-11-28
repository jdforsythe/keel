import type { Topology } from "@keel/compiler";
import { stdPlacedExports } from "@keel/compiler/std/stdPlacedExports";
import { clipMessage } from "@keel/schema/internal";
import type { Diagnostic } from "../types/Diagnostic.ts";
import { lineCol } from "./lineCol.ts";
import { readManifest } from "./modules/readManifest.ts";
import { parseFile } from "./parseFile.ts";

const MANIFEST = /^modules\/([^/]+)\/module\.[cm]?[jt]s$/;

/** The manifest `id` and `deps` of a `module.ts` text; `undefined` when it is not read statically. */
function manifestOf(file: { path: string; source: string }): { id: string | null; deps: string[] } | undefined {
  const parsed = parseFile(file);
  const m = parsed.ok ? readManifest(parsed.program) : null;
  return m === null ? undefined : { id: m.id, deps: m.deps.entries.map((e) => e.value) };
}

/**
 * E1552 (k.topology Rules) for each module id of a deployable in `<dir>topology.ts` (`source`) that is neither a folder
 * `modules/<id>/` of `files` (project-relative paths, a library's files at its module folder) holding a `module.ts`
 * nor the root manifest `id` of a stdlib or library package in an app manifest's `deps` (its `node_modules/<dep>/module.ts`
 * among `files`, else `stdPlacedExports` from the packages under `root`); message `<name>: unknown module <id>`, at the id's string literal after the deployable's key.
 */
export function unknownModules(
  dir: string,
  topology: Topology,
  source: string,
  files: readonly { path: string; source: string }[],
  root: string,
): Diagnostic[] {
  const own = new Set(files.flatMap((f) => MANIFEST.exec(f.path)?.[1] ?? []));
  const deps = new Set(files.flatMap((f) => (MANIFEST.test(f.path) ? (manifestOf(f)?.deps ?? []) : [])));
  for (const f of files) {
    const dep = /(?:^|\/)node_modules\/((?:@[^/]+\/)?[^/]+)\/module\.ts$/.exec(f.path)?.[1];
    const id = dep === undefined || !deps.has(dep) ? undefined : manifestOf(f)?.id;
    if (typeof id === "string") own.add(id);
  }
  const known = new Map<string, boolean>();
  const isKnown = (id: string): boolean => {
    const hit = known.get(id) ?? (own.has(id) || stdPlacedExports(root, id, files) !== undefined);
    known.set(id, hit);
    return hit;
  };
  const out: Diagnostic[] = [];
  for (const [name, deployable] of Object.entries(topology)) {
    const key = source.search(new RegExp(`(?<![\\w$-])['"\`]?${name.replace(/\W/g, "\\$&")}['"\`]?\\s*:`));
    const from = Math.max(0, key);
    for (const id of new Set(deployable.modules)) {
      if (isKnown(id)) continue;
      const literal = new RegExp(`(['"\`])${id.replace(/\W/g, "\\$&")}\\1(?!\\s*:)`).exec(source.slice(from));
      const { line, col } = lineCol(source, literal === null ? from : from + literal.index);
      const message = clipMessage(`${name}: unknown module ${id}`, 89);
      out.push({ kind: "diag", code: "E1552", path: `${dir}topology.ts`, line, col, message, see: "k.topology" });
    }
  }
  return out;
}

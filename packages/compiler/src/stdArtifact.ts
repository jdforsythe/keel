import { s } from "@keel/schema";
import type { JsonValue } from "@keel/schema";
import { appManifest } from "./internal/appManifest.ts";
import { hashOf } from "./internal/hashOf.ts";
import { lineCol } from "./internal/lineCol.ts";
import { stdIssue } from "./internal/stdIssue.ts";
import type { Diagnostic } from "./types/Diagnostic.ts";
import type { SourceFile } from "./types/SourceFile.ts";
import type { StdData } from "./types/StdData.ts";

const MANIFEST = /^modules\/([^/]+)\/module\.[cm]?[jt]s$/;
const STD = /^@keel\/std-[^/]+$/;
const Json = s.json();
/** `v` as `std.json` will hold it, after a JSON round-trip (backlog 0195); undefined when JSON cannot hold it. */
const viaJson = (v: JsonValue | undefined): JsonValue | undefined => {
  const r = v === undefined ? undefined : Json.parse(JSON.parse(JSON.stringify(v)));
  return r?.ok === true ? r.value : undefined;
};
const clip = (x: string): string => (x.length > 28 ? `${x.slice(0, 25)}...` : x);

/**
 * The data of `.keel/std.json` (k.module Std config, rfc:0066): every app manifest's (`modules/<id>/module.ts`,
 * root-relative) `std` entries, read statically, as `{ [pkg]: { [moduleId]: config } }`. An entry whose key is not a
 * `@keel/std-*` package in that module's `deps`, whose value is not literal JSON, or whose value fails the schema
 * registered under its package (`s.register`), checked as `std.json` holds it (after a JSON round-trip), is E1158,
 * worded as `keel check`'s, and left out. An opaque manifest
 * contributes nothing. `hash` is the artifact's content hash of `data`. Pure over `files` and the schema registry.
 */
export function stdArtifact(files: readonly SourceFile[]): { data: StdData; hash: string; diagnostics: Diagnostic[] } {
  const data: Record<string, Record<string, JsonValue>> = Object.create(null);
  const diagnostics: Diagnostic[] = [];
  const registry = s.registry();
  for (const f of [...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))) {
    const id = MANIFEST.exec(f.path)?.[1];
    const m = id === undefined ? null : appManifest(f.source);
    if (id === undefined || m === null) continue;
    const deps = new Set(m.deps.map((d) => d.value));
    for (const e of m.std) {
      const k = clip(e.key);
      const value = viaJson(e.value);
      const issue = stdIssue(registry.get(e.key), value);
      const message =
        !STD.test(e.key) || !deps.has(e.key)
          ? `std key ${k} is not a stdlib package in deps of module ${clip(id)}`
          : value === undefined
            ? `std config for ${k} in module ${clip(id)} is not literal JSON`
            : issue === undefined
              ? undefined
              : `std config for ${k} fails its schema ${issue}`;
      if (message !== undefined) {
        diagnostics.push({ code: "E1158", path: f.path, ...lineCol(f.source, e.start), message, see: "k.module" });
        continue;
      }
      if (value === undefined) continue;
      const byModule: Record<string, JsonValue> = data[e.key] ?? Object.create(null);
      byModule[id] = value;
      data[e.key] = byModule;
    }
  }
  return { data, hash: hashOf(data), diagnostics };
}

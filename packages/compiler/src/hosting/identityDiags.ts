import { lineCol } from "../internal/lineCol.ts";
import { routeLiterals } from "../routeLiterals.ts";
import type { Diagnostic } from "../types/Diagnostic.ts";
import type { SourceFile } from "../types/SourceFile.ts";
import { identitySource } from "./identitySource.ts";
import { mountDiags } from "./mountDiags.ts";
import { mountSource } from "./mountSource.ts";

/**
 * E1579 (k.user Rules) of the project's `identity.server.ts`: with `local`, its own problem (`identitySource`) at its
 * first line; and one per route of any module (`routeLiterals`, read without evaluating) whose literal path is at or
 * under its `handle.path` (a literal, or `identity.ts`'s through `mount.path`), at that route's id in its
 * contract file; with `local`, also the k.mount rules (`mountDiags`). `keel build` asks for all, `keel
 * check` for the routes only (`check()` reports the rest). `root` is where package manifests resolve from. No fix.
 */
export function identityDiags(files: readonly SourceFile[], root?: string, local = false): Diagnostic[] {
  const source = files.find((f) => f.path === "identity.server.ts")?.source;
  const read = source === undefined ? {} : identitySource(source);
  // `handle.path` as a literal, or as `mount.path` of `identity.ts` (k.mount).
  const mount = files.find((f) => f.path === "identity.ts")?.source;
  const at =
    read.problem !== undefined ? undefined : read.mounted && mount !== undefined ? mountSource(mount).path : read.path;
  const out: Diagnostic[] = !local
    ? []
    : [
        ...(read.problem === undefined
          ? []
          : [{ code: "E1579", path: "identity.server.ts", line: 1, col: 1, message: read.problem, see: "k.user" }]),
        ...mountDiags(files),
      ];
  if (at === undefined) return out;
  for (const [id, r] of Object.entries(routeLiterals(files, { root })?.routes ?? {})) {
    if (typeof r.path !== "string" || !`${r.path}/`.startsWith(`${at}/`)) continue;
    const module = id.split(".")[0] ?? id;
    const file = r.file ?? `modules/${module}/${module}.contract.ts`;
    const text = files.find((f) => f.path === file)?.source ?? "";
    out.push({
      code: "E1579",
      path: file,
      ...lineCol(text, Math.max(0, text.indexOf(id))),
      message: `route ${id} at ${r.path} is under identity handle.path ${at}; move the route or the mount`,
      see: "k.user",
    });
  }
  return out;
}

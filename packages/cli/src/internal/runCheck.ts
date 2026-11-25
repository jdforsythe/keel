import { existsSync } from "node:fs";
import { join } from "node:path";
import { check } from "@keel/check";
import { importDeps } from "@keel/compiler/std/importDeps";
import type { SourceFile } from "../types/SourceFile.ts";
import type { CheckDiagnostic } from "./CheckDiagnostic.ts";
import type { Diag } from "./Diag.ts";
import { checkTokens } from "./checkTokens.ts";
import { projectTopology } from "./projectTopology.ts";
import { relPath } from "./relPath.ts";

/**
 * Run the k.check pipeline over `files` (the root `topology.ts` of `project` is parsed for E1004); its diagnostics
 * pass through unchanged except for project-relative paths. E1005 compares each checked `.keel/` artifact with the
 * hashes the compiler derives from every source of its project in `project`, not only the checked ones (rfc:0050, rfc:0055).
 * First the `@keel/std-*` packages in the `deps` of `project`'s app manifests are imported, so their rules and config
 * schemas register (k.module Std config, rfc:0066); one that cannot be is E1159, listed before the check's diagnostics.
 * `base` is the parsed `surface.json` of `keel check --base` (k.compat E1562). The type pass keeps its results in the
 * project's `node_modules/.cache/keel` when the project has `node_modules` (k.check-cache), so a `keel check` after a
 * `keel build` (whose check runs here too) over the same files reuses the build's; a reused result is the one a run
 * with the folder deleted gives. Each project's `tokens.ts` is evaluated first (`checkTokens`, k.a11y-static Tokens): its
 * tokens reach the rules that judge them (E1804, E1809, E1801 over `base` and looks), and one that gives none is E1807.
 */
export async function runCheck(
  cwd: string,
  files: readonly SourceFile[],
  project: readonly SourceFile[] = files,
  base?: unknown,
): Promise<Diag[]> {
  const loaded = await importDeps(cwd, project);
  const topology = projectTopology(project);
  const options = topology === undefined ? {} : { topology };
  const modules = join(cwd, "node_modules");
  const cache = existsSync(modules) ? { typeCache: join(modules, ".cache", "keel") } : {};
  const tokens = await checkTokens(cwd, project);
  const found: readonly CheckDiagnostic[] = [
    ...loaded,
    ...tokens.diags,
    ...check(
      files.map((f) => ({ path: f.path, source: f.source })),
      {
        root: cwd,
        ...options,
        ...cache,
        project,
        projectArtifacts: tokens.projectArtifacts,
        ...(base === undefined ? {} : { base }),
      },
    ).diagnostics,
  ];
  return found.map((d) => ({
    kind: "diag",
    code: d.code,
    ...(d.path === undefined ? {} : { path: relPath(cwd, d.path) }),
    ...(d.line === undefined ? {} : { line: d.line }),
    ...(d.col === undefined ? {} : { col: d.col }),
    message: d.message,
    ...(d.fix === undefined ? {} : { fix: d.fix }),
    ...(d.see === undefined ? {} : { see: d.see }),
  }));
}

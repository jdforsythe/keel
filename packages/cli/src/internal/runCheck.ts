import { existsSync } from "node:fs";
import { join } from "node:path";
import { check, compiledViews, libraryEntryDiags } from "@keel/check";
import { importDeps } from "@keel/compiler/std/importDeps";
import type { SourceFile } from "../types/SourceFile.ts";
import type { CheckDiagnostic } from "./CheckDiagnostic.ts";
import type { Diag } from "./Diag.ts";
import { checkInputs } from "./checkInputs.ts";
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
 * with the folder deleted gives. Each project's `tokens.ts` is evaluated first (`checkTokens`, k.a11y-static Tokens), unless a library's entry is
 * E1815 (`libraryEntryDiags`), when nothing is imported or evaluated (k.looks Entries): its
 * tokens reach the rules that judge them (E1804, E1809, E1801 over `base` and looks), and one that gives none is E1807.
 * The files of the libraries `project`'s manifests reach join `project` and, with `libraries`, the checked files
 * (`checkInputs`, k.library In an app). `reach` holds the manifests whose `deps` name the libraries read and imported
 * (default `project`; a library's own folder gives its own manifest, k.library-pack Own folder).
 * `views` (k.derived): `derived`, each project's evaluated views, reaches `check` (the current surface, E1511, and an
 * evaluated view among `files` compared); and the compiled views of each of `dirs` (`compiledViews`, with the
 * evaluated tokens) are put in `out`, from the same inputs the check ran over.
 */
export async function runCheck(
  cwd: string,
  files: readonly SourceFile[],
  project: readonly SourceFile[] = files,
  base?: unknown,
  libraries = false,
  reach: readonly SourceFile[] = project,
  views?: {
    readonly derived: Readonly<Record<string, Readonly<Record<string, string>>>>;
    readonly dirs: readonly string[];
    readonly out: Map<string, Readonly<Record<string, string | null>>>;
  },
): Promise<Diag[]> {
  const { all, checked } = checkInputs(cwd, files, project, libraries, reach);
  // While a library's entry lists `keel` other than first (E1815, which check() reports), nothing is evaluated: no
  // package is imported and no `tokens.ts` run, so no file other than the one check reads as source can load.
  const guarded = libraryEntryDiags(all).length > 0;
  const loaded = guarded ? [] : await importDeps(cwd, reach);
  const topology = projectTopology(project);
  const options = topology === undefined ? {} : { topology };
  const modules = join(cwd, "node_modules");
  const cache = existsSync(modules) ? { typeCache: join(modules, ".cache", "keel") } : {};
  const tokens = guarded ? { projectArtifacts: {}, diags: [] } : await checkTokens(cwd, project);
  const found: readonly CheckDiagnostic[] = [
    ...loaded,
    ...tokens.diags,
    ...check(
      checked.map((f) => ({ path: f.path, source: f.source })),
      {
        root: cwd,
        ...options,
        ...cache,
        project: all,
        ...(Object.keys(tokens.projectArtifacts).length === 0 ? {} : { projectArtifacts: tokens.projectArtifacts }),
        ...(base === undefined ? {} : { base }),
        ...(views === undefined ? {} : { derived: views.derived }),
      },
    ).diagnostics,
  ];
  const given = Object.keys(tokens.projectArtifacts).length === 0 ? {} : { projectArtifacts: tokens.projectArtifacts };
  for (const dir of views?.dirs ?? []) views?.out.set(dir, compiledViews(dir, all, { ...options, ...given }));
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

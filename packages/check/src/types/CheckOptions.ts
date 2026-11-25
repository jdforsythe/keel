import type { Topology } from "@keel/compiler";
import type { Budget } from "./Budget.ts";
import type { SourceFile } from "./SourceFile.ts";

/**
 * Options for `check`. `root`: directory module specifiers resolve from (default `process.cwd()`).
 * `budgets`: measurements to enforce (E1755). `artifacts`: read-only project artifacts handed to rules,
 * merged over the ones compiled from `files`; never a source of E1005 hashes. `projectArtifacts`: the same per project,
 * keyed by project directory (`""` the root, `apps/a/`), between the compiled ones and `artifacts` (the cli passes
 * each project's `tokens`, k.a11y-static). `project`: the files E1005
 * derives each checked `.keel/` dir's expected hashes from (default `files`); the cli passes the whole project.
 * `topology`: the parsed `topology.ts`, passed to `compile` (E1004 is not reported in client-only deployables). `types: false` skips pipeline step 1b.
 * `base`: the parsed `surface.json` of the deployed code (`keel check --base`, k.compat); without it, no E1562.
 * `typeCache`: a folder the type pass keeps its results in across processes (k.check-cache), each used only when every
 * file system question the pass asked gets the same answer again (file bytes by hash, existence, real paths, listings);
 * results are the same with or without it.
 */
export type CheckOptions = {
  readonly root?: string;
  readonly budgets?: readonly Budget[];
  readonly artifacts?: Readonly<Record<string, unknown>>;
  readonly projectArtifacts?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  readonly project?: readonly SourceFile[];
  readonly topology?: Topology | undefined;
  readonly types?: boolean;
  readonly base?: unknown;
  readonly typeCache?: string;
};

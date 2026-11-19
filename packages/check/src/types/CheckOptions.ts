import type { Topology } from "@keel/compiler";
import type { Budget } from "./Budget.ts";
import type { SourceFile } from "./SourceFile.ts";

/**
 * Options for `check`. `root`: directory module specifiers resolve from (default `process.cwd()`).
 * `budgets`: measurements to enforce (E1755). `artifacts`: read-only project artifacts handed to rules,
 * merged over the ones compiled from `files`; never a source of E1005 hashes (rfc:0055). `project`: the files E1005
 * derives each checked `.keel/` dir's expected hashes from (default `files`); the cli passes the whole project.
 * `topology`: the parsed `topology.ts`, passed to `compile` (E1004 is not reported in client-only deployables). `types: false` skips pipeline step 1b.
 * `base`: the parsed `surface.json` of the deployed code (`keel check --base`, k.compat); without it, no E1562.
 */
export type CheckOptions = {
  readonly root?: string;
  readonly budgets?: readonly Budget[];
  readonly artifacts?: Readonly<Record<string, unknown>>;
  readonly project?: readonly SourceFile[];
  readonly topology?: Topology;
  readonly types?: boolean;
  readonly base?: unknown;
};

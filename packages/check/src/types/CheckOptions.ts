import type { Topology } from "@keel/compiler";
import type { Budget } from "./Budget.ts";

/**
 * Options for `check`. `root`: directory module specifiers resolve from (default `process.cwd()`).
 * `budgets`: measurements to enforce (E1755). `artifacts`: read-only project artifacts handed to rules,
 * merged over the ones compiled from `files`.
 * `topology`: the parsed `topology.ts`, passed to `compile` (E1004 is not reported in client-only deployables). `types: false` skips pipeline step 1b.
 */
export type CheckOptions = {
  readonly root?: string;
  readonly budgets?: readonly Budget[];
  readonly artifacts?: Readonly<Record<string, unknown>>;
  readonly topology?: Topology;
  readonly types?: boolean;
};

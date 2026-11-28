import type { RouteEntry } from "./RouteEntry.ts";

/**
 * A project the a11y claims read (k.a11y Claims): `project` its directory relative to the run (`.` for the run's own),
 * `dir` that directory as a path prefix (`""` or `apps/golden-1/`), and the entries of its `.keel/routes.json`.
 */
export type A11yProject = {
  readonly project: string;
  readonly dir: string;
  readonly entries: readonly RouteEntry[];
};

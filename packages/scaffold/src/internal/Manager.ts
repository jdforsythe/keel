/**
 * A package manager as a project uses it (k.create Package manager): its `name`, the install a person runs, the
 * prefix that runs `keel` through the project, CI's frozen install, its lockfile's pattern among CI's shared files and its name, the
 * setup steps CI runs after the checkout (YAML lines) and the `keel` prefix CI runs.
 */
export type Manager = {
  readonly name: "pnpm" | "npm" | "yarn" | "bun";
  readonly install: string;
  readonly run: string;
  readonly ci: string;
  readonly lock: string;
  readonly lockfile: string;
  readonly setup: readonly string[];
  readonly exec: string;
};

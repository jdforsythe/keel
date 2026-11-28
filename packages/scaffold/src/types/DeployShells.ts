import type { ShellApp } from "./ShellApp.ts";
import type { ShellJob } from "./ShellJob.ts";

/**
 * The registered shell targets the deploy generator reads (k.shell Shell target), by shell: each one's shell files
 * (paths under `deploy/<name>/<shell>/`, already held inside that folder) and CI jobs. A shell without a target here
 * gets no files and no jobs, and its files are neither written nor removed.
 */
export type DeployShells = {
  readonly [S in "capacitor" | "tauri"]?: {
    readonly files: (app: ShellApp) => Readonly<Record<string, string>>;
    readonly ci: (app: ShellApp) => readonly ShellJob[];
  };
};

import type { ShellTarget } from "@keel/cli";
import { tauriBuild } from "./tauriBuild.ts";
import { tauriFiles } from "./tauriFiles.ts";
import { tauriJobs } from "./tauriJobs.ts";
import { tauriTools } from "./tauriTools.ts";

/**
 * The Tauri shell target (std.tauri): desktop, no `--platform`. `plugins` is empty: each plugin's JavaScript half is
 * this package's own dependency and its crate is in the generated `Cargo.toml`, so an app lists none.
 */
export const tauriTarget: ShellTarget = {
  platforms: [],
  files: tauriFiles,
  tools: tauriTools,
  plugins: () => [],
  build: tauriBuild,
  ci: tauriJobs,
};

import type { ShellTarget } from "@keel/cli";
import { tauriBuild } from "./tauriBuild.ts";
import { tauriFiles } from "./tauriFiles.ts";
import { tauriJobs } from "./tauriJobs.ts";
import { tauriTools } from "./tauriTools.ts";

/** The Tauri shell target (std.tauri): desktop, no `--platform`. */
export const tauriTarget: ShellTarget = {
  platforms: [],
  files: tauriFiles,
  tools: tauriTools,
  build: tauriBuild,
  ci: tauriJobs,
};

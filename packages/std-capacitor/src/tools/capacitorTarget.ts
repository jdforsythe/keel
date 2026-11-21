import type { ShellTarget } from "@keel/cli";
import { capacitorBuild } from "./capacitorBuild.ts";
import { capacitorFiles } from "./capacitorFiles.ts";
import { capacitorJobs } from "./capacitorJobs.ts";
import { capacitorTools } from "./capacitorTools.ts";

/** The Capacitor shell target (std.capacitor): `--platform android` or `ios`. */
export const capacitorTarget: ShellTarget = {
  platforms: ["android", "ios"],
  files: capacitorFiles,
  tools: capacitorTools,
  build: capacitorBuild,
  ci: capacitorJobs,
};

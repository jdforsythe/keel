import type { ShellApp, ShellJob } from "@keel/cli";
import { crateName } from "./crateName.ts";

/** Debian packages a Tauri Linux build needs (std.tauri Tools: WebKitGTK 4.1). */
const TAURI_APT =
  "libwebkit2gtk-4.1-dev build-essential libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev";

/** The Tauri CI job (std.tauri CI): `tauri` on `ubuntu-24.04`, installing WebKitGTK 4.1, uploading the debug binary. */
export function tauriJobs(app: ShellApp): readonly ShellJob[] {
  return [
    {
      job: "tauri",
      runsOn: "ubuntu-24.04",
      manual: false,
      steps: [`sudo apt-get update && sudo apt-get install -y ${TAURI_APT}`],
      env: {},
      artifact: `dist/${app.deployable}/tauri/target/debug/${crateName(app.pkg)}`,
    },
  ];
}

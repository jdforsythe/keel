// The Tauri shell target's registration (std.tauri), which `@keel/std-tauri/tools` (`tools/index.ts`) runs first. No exports.
import { shellTarget } from "@keel/cli";
import { tauriTarget } from "./tools/tauriTarget.ts";

shellTarget("tauri", tauriTarget);

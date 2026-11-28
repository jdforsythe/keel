import type { ShellApp } from "@keel/cli";
import { cargoToml } from "./cargoToml.ts";
import { crateName } from "./crateName.ts";
import { tauriBuildRs } from "./tauriBuildRs.ts";
import { tauriCapability } from "./tauriCapability.ts";
import { tauriConf } from "./tauriConf.ts";
import { tauriLibRs } from "./tauriLibRs.ts";
import { tauriMainRs } from "./tauriMainRs.ts";

/**
 * The Tauri shell files under `deploy/<name>/tauri/` (std.tauri Files): `tauri.conf.json` (only with the app's policy),
 * `Cargo.toml` (the crate named from `pkg`), `build.rs`, `src/main.rs`, `src/lib.rs` and `capabilities/default.json`,
 * with the plugins of k.return when the project has `identity.ts`.
 */
export function tauriFiles(app: ShellApp): Readonly<Record<string, string>> {
  return {
    ...(app.policy === undefined ? {} : { "tauri.conf.json": tauriConf(app, app.version, app.policy) }),
    "Cargo.toml": cargoToml(crateName(app.pkg), app.version, app.identity),
    "build.rs": tauriBuildRs(),
    "src/main.rs": tauriMainRs(),
    "src/lib.rs": tauriLibRs(app.identity),
    "capabilities/default.json": tauriCapability(app.identity),
  };
}

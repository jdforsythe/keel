/** Crate versions, exact; `tauri` 2.12.5 needs Rust 1.95 (k.shell Build). */
const TAURI = "2.12.5";
const TAURI_BUILD = "2.7.4";
const STORE = "2.5.1";
const HTTP = "2.9.0";
/** The context macro of `src/lib.rs` reads `tauri.conf.json`'s plugin configuration through it. */
const SERDE_JSON = "1.0.154";
const DEEP_LINK = "2.6.3";
const OPENER = "2.7.3";
const SINGLE_INSTANCE = "2.5.5";

/**
 * `deploy/<name>/tauri/Cargo.toml` (k.shell Files): the shell crate `crate` at the app's `version`, with exact versions
 * of `tauri`, `tauri-build`, `serde_json`, `tauri-plugin-store` and `tauri-plugin-http`; with `identity` (the project has
 * `identity.ts`, k.return) also `tauri-plugin-deep-link`, `tauri-plugin-opener` and `tauri-plugin-single-instance`.
 * Its library is `keel_shell`.
 */
export function cargoToml(crate: string, version: string, identity = false): string {
  return [
    "# _generated: keel writes this from topology.ts (k.shell). Do not edit by hand.",
    "[package]",
    `name = "${crate}"`,
    `version = "${version}"`,
    'edition = "2021"',
    'rust-version = "1.95"',
    "publish = false",
    "",
    "[lib]",
    'name = "keel_shell"',
    'crate-type = ["rlib"]',
    "",
    "[build-dependencies]",
    `tauri-build = { version = "=${TAURI_BUILD}", features = [] }`,
    "",
    "[dependencies]",
    `tauri = { version = "=${TAURI}", features = [] }`,
    `serde_json = "=${SERDE_JSON}"`,
    `tauri-plugin-store = "=${STORE}"`,
    `tauri-plugin-http = "=${HTTP}"`,
    ...(identity
      ? [
          `tauri-plugin-deep-link = "=${DEEP_LINK}"`,
          `tauri-plugin-opener = "=${OPENER}"`,
          `tauri-plugin-single-instance = { version = "=${SINGLE_INSTANCE}", features = ["deep-link"] }`,
        ]
      : []),
    "",
  ].join("\n");
}

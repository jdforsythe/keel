/** Crate versions, exact; `tauri` 2.12.5 needs Rust 1.95 (k.shell Build). */
const TAURI = "2.12.5";
const TAURI_BUILD = "2.7.4";
const STORE = "2.5.1";
const HTTP = "2.9.0";

/**
 * `deploy/<name>/tauri/Cargo.toml` (k.shell Files): the shell crate `crate` at the app's `version`, with exact versions
 * of `tauri`, `tauri-build`, `tauri-plugin-store` and `tauri-plugin-http`. Its library is `keel_shell`.
 */
export function cargoToml(crate: string, version: string): string {
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
    `tauri-plugin-store = "=${STORE}"`,
    `tauri-plugin-http = "=${HTTP}"`,
    "",
  ].join("\n");
}

/** `deploy/<name>/tauri/src/main.rs` (k.shell Files): the binary, which runs `keel_shell::run`; no console window on a Windows release build. */
export function tauriMainRs(): string {
  return [
    "// _generated: keel writes this from topology.ts (k.shell). Do not edit by hand.",
    '#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]',
    "",
    "fn main() {",
    "    keel_shell::run()",
    "}",
    "",
  ].join("\n");
}

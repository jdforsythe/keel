/** `deploy/<name>/tauri/build.rs` (k.shell Files): Tauri's build step. */
export function tauriBuildRs(): string {
  return [
    "// _generated: keel writes this from topology.ts (k.shell). Do not edit by hand.",
    "fn main() {",
    "    tauri_build::build()",
    "}",
    "",
  ].join("\n");
}

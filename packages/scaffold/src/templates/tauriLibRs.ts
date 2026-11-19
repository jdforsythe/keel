/** `deploy/<name>/tauri/src/lib.rs` (k.shell Files): the app with the store and http plugins the shell drivers call (std.shells). */
export function tauriLibRs(): string {
  return [
    "// _generated: keel writes this from topology.ts (k.shell). Do not edit by hand.",
    "pub fn run() {",
    "    tauri::Builder::default()",
    "        .plugin(tauri_plugin_store::Builder::default().build())",
    "        .plugin(tauri_plugin_http::init())",
    "        .run(tauri::generate_context!())",
    '        .expect("the Tauri app failed to start");',
    "}",
    "",
  ].join("\n");
}

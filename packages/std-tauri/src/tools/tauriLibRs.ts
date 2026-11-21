/**
 * `deploy/<name>/tauri/src/lib.rs` (k.shell Files): the app with the store and http plugins the shell drivers call
 * (std.shells). With `identity` (the project has `identity.ts`, k.return) it also takes return links (the deep-link
 * plugin; a second launch hands its link to the running app) and opens the default browser
 * (the opener plugin).
 */
export function tauriLibRs(identity = false): string {
  return [
    "// _generated: keel writes this from topology.ts (k.shell). Do not edit by hand.",
    "pub fn run() {",
    "    tauri::Builder::default()",
    ...(identity
      ? [
          "        .plugin(tauri_plugin_single_instance::init(|_, _, _| {}))",
          "        .plugin(tauri_plugin_deep_link::init())",
          "        .plugin(tauri_plugin_opener::init())",
        ]
      : []),
    "        .plugin(tauri_plugin_store::Builder::default().build())",
    "        .plugin(tauri_plugin_http::init())",
    "        .run(tauri::generate_context!())",
    '        .expect("the Tauri app failed to start");',
    "}",
    "",
  ].join("\n");
}

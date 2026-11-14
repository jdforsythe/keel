import { jsonText } from "../internal/jsonText.ts";

/**
 * `deploy/<name>/tauri/capabilities/default.json` (k.shell Files): the main window may use Tauri's core and the store
 * plugin. `keel build --target tauri` writes the http permission for `KEEL_ORIGIN` beside it.
 */
export function tauriCapability(): string {
  return `${jsonText({
    identifier: "default",
    description: "The main window's core and store permissions.",
    windows: ["main"],
    permissions: ["core:default", "store:default"],
  })}\n`;
}

import { jsonText } from "./jsonText.ts";

/**
 * `deploy/<name>/tauri/capabilities/default.json` (k.shell Files): the main window may use Tauri's core and the store
 * plugin and read launch and return links (k.links) and, with `identity` (the project has `identity.ts`, k.return),
 * open `https:` URLs in the default browser. `keel build --target tauri` writes the http permission beside it.
 */
export function tauriCapability(identity = false): string {
  return `${jsonText({
    identifier: "default",
    description: "The main window's core, store and link permissions.",
    windows: ["main"],
    permissions: [
      "core:default",
      "store:default",
      "deep-link:default",
      ...(identity ? [{ identifier: "opener:allow-open-url", allow: [{ url: "https://*" }] }] : []),
    ],
  })}\n`;
}

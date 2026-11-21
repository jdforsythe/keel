import { jsonText } from "./jsonText.ts";

/**
 * `deploy/<name>/tauri/capabilities/default.json` (k.shell Files): the main window may use Tauri's core and the store
 * plugin and, with `identity` (the project has `identity.ts`, k.return), read return links and open `https:` URLs in
 * the default browser. `keel build --target tauri` writes the http permission for `KEEL_ORIGIN` beside it.
 */
export function tauriCapability(identity = false): string {
  return `${jsonText({
    identifier: "default",
    description: "The main window's core and store permissions.",
    windows: ["main"],
    permissions: [
      "core:default",
      "store:default",
      ...(identity
        ? ["deep-link:default", { identifier: "opener:allow-open-url", allow: [{ url: "https://*" }] }]
        : []),
    ],
  })}\n`;
}

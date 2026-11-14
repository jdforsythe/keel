import { jsonText } from "../internal/jsonText.ts";

/**
 * `capabilities/http.json` of a Tauri shell build (k.shell Build): the http plugin may reach `origin`, the build's
 * `KEEL_ORIGIN`, and no other origin.
 */
export function tauriHttpCapability(origin: string): string {
  return `${jsonText({
    identifier: "http",
    description: "The main window may send requests to the app's server only.",
    windows: ["main"],
    permissions: [{ identifier: "http:default", allow: [{ url: `${origin}/*` }] }],
  })}\n`;
}

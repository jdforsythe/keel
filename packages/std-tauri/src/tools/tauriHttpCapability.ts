import { jsonText } from "./jsonText.ts";

/**
 * `capabilities/http.json` of a Tauri shell build (k.shell Build): the http plugin may reach `origin`, the build's
 * `KEEL_ORIGIN`, and no other origin; with `identity` (the project has `identity.ts`, k.return) the default browser
 * may be opened on that origin too, which an `http:` one needs.
 */
export function tauriHttpCapability(origin: string, identity = false): string {
  return `${jsonText({
    identifier: "http",
    description: "The main window may send requests to the app's server only.",
    windows: ["main"],
    permissions: [
      { identifier: "http:default", allow: [{ url: `${origin}/*` }] },
      ...(identity ? [{ identifier: "opener:allow-open-url", allow: [{ url: `${origin}/*` }] }] : []),
    ],
  })}\n`;
}

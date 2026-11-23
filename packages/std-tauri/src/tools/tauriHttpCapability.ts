import { jsonText } from "./jsonText.ts";

/**
 * `capabilities/http.json` of a Tauri shell build (std.tauri Build): the http plugin may reach `origin`, the build's
 * `KEEL_ORIGIN`, and each `connect` origin (k.shell Origins), and no other; with `identity` (the project has
 * `identity.ts`, k.return) the default browser may be opened on `origin` too, which an `http:` one needs.
 */
export function tauriHttpCapability(origin: string, connect: readonly string[] = [], identity = false): string {
  const allow = [origin, ...connect.filter((o) => o !== origin)].map((o) => ({ url: `${o}/*` }));
  return `${jsonText({
    identifier: "http",
    description: "The main window may send requests to the app's declared origins only.",
    windows: ["main"],
    permissions: [
      { identifier: "http:default", allow },
      ...(identity ? [{ identifier: "opener:allow-open-url", allow: [{ url: `${origin}/*` }] }] : []),
    ],
  })}\n`;
}

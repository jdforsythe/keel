import { jsonText } from "./jsonText.ts";

/**
 * `capabilities/http.json` of a Tauri shell build (std.tauri Build): the http plugin may reach `origin`, the build's
 * `KEEL_ORIGIN` when it has one, and each `connect` origin (k.shell Origins), and no other; with `identity` (the
 * project has `identity.ts`, k.return) the default browser may be opened on `origin` too, which an `http:` one needs.
 * With no origin to allow, undefined: the build writes no file, so the http plugin's `fetch` is denied.
 */
export function tauriHttpCapability(
  origin: string | undefined,
  connect: readonly string[] = [],
  identity = false,
): string | undefined {
  const origins = [...(origin === undefined ? [] : [origin]), ...connect.filter((o) => o !== origin)];
  if (origins.length === 0) return undefined;
  const allow = origins.map((o) => ({ url: `${o}/*` }));
  return `${jsonText({
    identifier: "http",
    description: "The main window may send requests to the app's declared origins only.",
    windows: ["main"],
    permissions: [
      { identifier: "http:default", allow },
      ...(identity && origin !== undefined
        ? [{ identifier: "opener:allow-open-url", allow: [{ url: `${origin}/*` }] }]
        : []),
    ],
  })}\n`;
}

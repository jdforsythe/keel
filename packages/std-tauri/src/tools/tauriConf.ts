import { jsonText } from "./jsonText.ts";

/** The source Tauri's IPC is served from; `connect-src` must allow it or the plugins cannot reach the shell. */
const IPC = "ipc: http://ipc.localhost";

/**
 * `deploy/<name>/tauri/tauri.conf.json` (k.shell Files): `identifier`, `productName`, the app's `version`, the built
 * files in `www`, one window titled `name`, `policy` (the deployable's content security policy) with Tauri's IPC
 * origin added to `connect-src`, the `id` as the deep-link plugin's one desktop scheme, the scheme of the shell's
 * return links (k.return), and `plugins.http.scopeRedirects`, under which the http plugin holds every redirect hop of
 * a request to its scope.
 */
export function tauriConf(
  shell: { readonly id: string; readonly name: string },
  version: string,
  policy: string,
): string {
  const csp = policy
    .split(";")
    .map((d) => d.trim())
    .filter((d) => d !== "")
    .map((d) => (d.startsWith("connect-src ") ? `${d} ${IPC}` : d))
    .join("; ");
  return `${jsonText({
    productName: shell.name,
    version,
    identifier: shell.id,
    build: { frontendDist: "www" },
    app: { windows: [{ label: "main", title: shell.name }], security: { csp } },
    plugins: { "deep-link": { desktop: { schemes: [shell.id] } }, http: { scopeRedirects: true } },
  })}\n`;
}

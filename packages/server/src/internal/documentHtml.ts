import { escapeHtml } from "./escapeHtml.ts";
import { stateJson } from "./stateJson.ts";

/**
 * The HTML document (k.runtime): `<!doctype html>` with `<html lang>` (k.head), `head` (`headHtml`) after the charset and viewport, the rendered
 * chain (wrapped in `<main>` unless it already has one), an optional dev panel, exactly one `<script type="application/json" id="k-state">`, and the
 * resume entry as `<script type="module" src nonce>` only when the page has islands (`entry` is its URL, else null: no islands, no runtime JS); `createApp` serves it (`servedEntry`). `nonce` is the document's
 * (k.security Policy): on the module script and on `<meta property="csp-nonce">`, which Vite's preload helper reads.
 * `scheme` and `theme`, the person's picks (k.schemes First paint), are written as `data-k-scheme` and `data-k-theme` on
 * `<html>`; a theme is one of the app's `choice` themes (`themeOf`), so it needs no escaping.
 */
export function documentHtml(
  body: string,
  state: unknown,
  devMessage: string | null,
  entry: string | null,
  head: string,
  lang: string,
  nonce: string,
  scheme?: "light" | "dark",
  theme?: string,
): string {
  const main = /<main[\s>]/i.test(body) ? body : `<main>${body}</main>`;
  const dev = devMessage === null ? "" : `<pre role="alert" data-k-dev="diag">${escapeHtml(devMessage)}</pre>`;
  return [
    `<!doctype html><html lang="${escapeHtml(lang)}"${scheme === undefined ? "" : ` data-k-scheme="${scheme}"`}${theme === undefined ? "" : ` data-k-theme="${theme}"`}><head><meta charset="utf-8">`,
    `<meta name="viewport" content="width=device-width, initial-scale=1">`,
    `<meta property="csp-nonce" nonce="${escapeHtml(nonce)}">${head}</head><body>`,
    main,
    dev,
    `<script type="application/json" id="k-state">${stateJson(state)}</script>`,
    entry === null ? "" : `<script type="module" src="${escapeHtml(entry)}" nonce="${escapeHtml(nonce)}"></script>`,
    "</body></html>",
  ].join("");
}

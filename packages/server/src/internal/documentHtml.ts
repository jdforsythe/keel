import { escapeHtml } from "./escapeHtml.ts";
import { stateJson } from "./stateJson.ts";

/**
 * The HTML document (k.runtime): `<!doctype html>`, `head` (`headHtml`) after the charset and viewport, the rendered
 * chain (wrapped in `<main>` unless it already has one), an optional dev panel, exactly one `<script type="application/json" id="k-state">`, and the
 * resume entry as `<script type="module" src>` only when the page has islands (`entry` is its URL, else null;
 * rfc:0037: no islands, no runtime JS); `createApp` serves it (`servedEntry`, RFC 0046, 0048).
 */
export function documentHtml(
  body: string,
  state: unknown,
  devMessage: string | null,
  entry: string | null,
  head: string,
): string {
  const main = /<main[\s>]/i.test(body) ? body : `<main>${body}</main>`;
  const dev = devMessage === null ? "" : `<pre role="alert" data-k-dev="diag">${escapeHtml(devMessage)}</pre>`;
  return [
    '<!doctype html><html lang="en"><head><meta charset="utf-8">',
    `<meta name="viewport" content="width=device-width, initial-scale=1">${head}</head><body>`,
    main,
    dev,
    `<script type="application/json" id="k-state">${stateJson(state)}</script>`,
    entry === null ? "" : `<script type="module" src="${escapeHtml(entry)}"></script>`,
    "</body></html>",
  ].join("");
}

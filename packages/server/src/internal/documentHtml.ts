import { escapeHtml } from "./escapeHtml.ts";
import { stateJson } from "./stateJson.ts";

/**
 * The HTML document (k.runtime): `<!doctype html>`, the rendered chain (wrapped in `<main>` unless it
 * already has one), an optional dev panel, and exactly one `<script type="application/json" id="k-state">`.
 */
export function documentHtml(body: string, state: unknown, devMessage: string | null): string {
  const main = /<main[\s>]/i.test(body) ? body : `<main>${body}</main>`;
  const dev = devMessage === null ? "" : `<pre role="alert" data-k-dev="diag">${escapeHtml(devMessage)}</pre>`;
  return [
    '<!doctype html><html lang="en"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1"></head><body>',
    main,
    dev,
    `<script type="application/json" id="k-state">${stateJson(state)}</script>`,
    "</body></html>",
  ].join("");
}

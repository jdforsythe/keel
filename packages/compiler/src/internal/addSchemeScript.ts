import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { SCHEME_SCRIPT } from "./SCHEME_SCRIPT.ts";

/**
 * Write `SCHEME_SCRIPT` as `assets/keel-scheme-<hash>.js` into a `client` or `static` build `out` and load it in the
 * head of each of its `docs` (paths under `out`), before the first stylesheet link, else before `</head>` (k.schemes
 * First paint). An external classic script, so `script-src 'self'` allows it and nothing is inline (k.security).
 */
export function addSchemeScript(out: string, docs: readonly string[]): void {
  const hash = createHash("sha256").update(SCHEME_SCRIPT).digest("hex").slice(0, 8);
  const rel = `assets/keel-scheme-${hash}.js`;
  fs.mkdirSync(path.join(out, "assets"), { recursive: true });
  fs.writeFileSync(path.join(out, rel), SCHEME_SCRIPT);
  const tag = `<script src="/${rel}"></script>`;
  for (const doc of docs) {
    const file = path.join(out, doc);
    if (!fs.existsSync(file)) continue;
    const html = fs.readFileSync(file, "utf8");
    if (html.includes(tag)) continue;
    const at = html.search(/<link\b[^>]*\brel="stylesheet"/);
    const end = html.indexOf("</head>");
    const i = at >= 0 && (end < 0 || at < end) ? at : end;
    if (i < 0) continue;
    fs.writeFileSync(file, `${html.slice(0, i)}${tag}${html.slice(i)}`);
  }
}

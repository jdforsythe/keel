import type { Diag } from "./Diag.ts";
import { where } from "./where.ts";

/** OUTPUT.md compact diagnostic: `CODE path:line:col message`, then the fix hunk, `see` and each `detail` line. */
export function diagCompact(d: Diag): string {
  const at = where(d);
  const head = at === "" ? `${d.code} ${d.message}` : `${d.code} ${at} ${d.message}`;
  // Compact shows the hunk only: the `--- a/` `+++ b/` file headers repeat the path already on the head line.
  const hunk =
    d.fix === undefined ? [] : d.fix.split("\n").filter((l) => !l.startsWith("--- ") && !l.startsWith("+++ "));
  const fix = hunk.map((l, i) => (i === 0 ? "  fix: " : "       ") + l);
  const see = d.see === undefined ? [] : [`  see: keel docs ${d.see}`];
  const detail = d.detail === undefined ? [] : d.detail.split("\n").map((l) => `  ${l}`);
  return [head, ...fix, ...see, ...detail].join("\n");
}

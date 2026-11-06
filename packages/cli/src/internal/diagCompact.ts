import type { Diag } from "./Diag.ts";
import { where } from "./where.ts";

/** OUTPUT.md compact diagnostic: `CODE path:line:col message`, then the fix hunk and `see`. */
export function diagCompact(d: Diag): string {
  const at = where(d);
  const head = at === "" ? `${d.code} ${d.message}` : `${d.code} ${at} ${d.message}`;
  const fix = d.fix === undefined ? [] : d.fix.split("\n").map((l, i) => (i === 0 ? "  fix: " : "       ") + l);
  const see = d.see === undefined ? [] : [`  see: ${d.see}`];
  return [head, ...fix, ...see].join("\n");
}

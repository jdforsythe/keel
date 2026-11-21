import type { Diag } from "./Diag.ts";
import { where } from "./where.ts";

/** Human rendering: location on its own line, message indented, fix and see below. */
export function diagPretty(d: Diag): string {
  const at = where(d);
  const fix = d.fix === undefined ? [] : ["  fix:", ...d.fix.split("\n").map((l) => `    ${l}`)];
  const see = d.see === undefined ? [] : [`  see: keel docs ${d.see}`];
  return [at === "" ? d.code : `${d.code}  ${at}`, `  ${d.message}`, ...fix, ...see].join("\n");
}

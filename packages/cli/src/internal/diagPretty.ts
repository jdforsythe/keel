import type { Diag } from "./Diag.ts";
import { where } from "./where.ts";

/** Human rendering: location on its own line, message indented, fix, see and detail lines below. */
export function diagPretty(d: Diag): string {
  const at = where(d);
  const fix = d.fix === undefined ? [] : ["  fix:", ...d.fix.split("\n").map((l) => `    ${l}`)];
  const see = d.see === undefined ? [] : [`  see: keel docs ${d.see}`];
  const detail = d.detail === undefined ? [] : d.detail.split("\n").map((l) => `  ${l}`);
  return [at === "" ? d.code : `${d.code}  ${at}`, `  ${d.message}`, ...fix, ...see, ...detail].join("\n");
}

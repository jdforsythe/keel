import type { Diag } from "./Diag.ts";
import { makeDiag } from "./makeDiag.ts";
import { noteDiag } from "./noteDiag.ts";

/** `<code> <path>:<line>:<col> <message>`: a problem line located in a file. */
const LOCATED = /^([EWI]\d{4}) ([^\s:]+):(\d+):(\d+) (.*)$/;
/** An unlocated refusal: its message names the call or read refused, first (k.compiler Build-time evaluation). */
const REFUSED = /^E1050 (.*)$/s;

/**
 * A problem line of a project's evaluation (k.compiler Build-time evaluation) as a diagnostic record: a located line
 * at its file, line and column; an unlocated E1050 with no location, its message starting with what it refused; else as
 * a build step's line reads (`noteDiag`); else E1049 with no location. An E1049
 * carries `see` k.compiler.
 */
export function evaluationDiag(line: string): Diag {
  const m = LOCATED.exec(line.trim());
  const refused = REFUSED.exec(line.trim());
  const d =
    m !== null
      ? makeDiag(m[1] ?? "", m[5] ?? "", { path: m[2], line: Number(m[3]), col: Number(m[4]) })
      : refused !== null
        ? makeDiag("E1050", refused[1] ?? "")
        : (noteDiag(line) ?? makeDiag("E1049", line));
  return d.code === "E1049" && d.see === undefined ? { ...d, see: "k.compiler" } : d;
}

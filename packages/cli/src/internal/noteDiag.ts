import type { Diag } from "./Diag.ts";
import { makeDiag } from "./makeDiag.ts";

/** `<code> <path> <message>`: a path is one word with a `/` or a `.` in it. */
const NOTE = /^([EWI]\d{4}) (?:([^\s:]*[/.][^\s:]*) )?(.*)$/;
/** `E1050 <path>:<line>:<col> <message>`: a refusal at a project file. */
const LOCATED = /^E1050 ([^\s:]+):(\d+):(\d+) (.*)$/s;

/**
 * A Keel-coded line of a build step (`E1006 modules/a/a.contract.ts failed to evaluate: boom`, `W1005 .keel/routes.json
 * differed ...`) as a diagnostic record: the code, the path when the second word is one, and the rest as the message.
 * A line that does not start with a code is `undefined`.
 */
export function noteDiag(line: string): Diag | undefined {
  const m = NOTE.exec(line.trim());
  if (m === null) return undefined;
  const [, code = "", path, message = ""] = m;
  // An E1050 is at the project file its line names, else unlocated (k.compiler Rules): its message starts with what
  // was refused.
  if (code === "E1050") {
    const at = LOCATED.exec(line.trim());
    return at === null
      ? makeDiag(code, line.trim().slice("E1050 ".length))
      : makeDiag(code, at[4] ?? "", { path: at[1], line: Number(at[2]), col: Number(at[3]) });
  }
  return makeDiag(code, message, path === undefined ? {} : { path });
}

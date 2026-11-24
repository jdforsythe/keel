import { clip } from "@keel/compiler/internal";
import type { Diagnostic } from "../types/Diagnostic.ts";
import type { RuleDef } from "../types/RuleDef.ts";

/** The E1756 for a rule whose `check`, `sql`, `message` or `fix` threw on the file at `path`. */
export function ruleThrew(rule: RuleDef, path: string, e: unknown): Diagnostic {
  const why = e instanceof Error ? e.message : String(e);
  return {
    kind: "diag",
    code: "E1756",
    path,
    line: 1,
    col: 1,
    message: clip(`rule ${rule.code} threw: ${clip(why, 60)}`, 89),
    see: "k.check",
  };
}

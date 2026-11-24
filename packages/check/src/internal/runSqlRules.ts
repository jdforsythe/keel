import { clipMessage } from "@keel/schema/internal";
import type { Diagnostic } from "../types/Diagnostic.ts";
import type { RuleDef } from "../types/RuleDef.ts";
import type { SourceFile } from "../types/SourceFile.ts";
import { ruleThrew } from "./ruleThrew.ts";

/**
 * Run each rule that has a `sql` reader on one SQL file (pipeline step 3). A SQL finding carries no fix. A reader or
 * `message` that throws yields one E1756 naming the rule, and the other rules still run.
 */
export function runSqlRules(all: readonly RuleDef[], file: SourceFile): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const rule of all) {
    if (rule.sql === undefined) continue;
    try {
      for (const f of rule.sql(file)) {
        const text = typeof rule.message === "string" ? rule.message : rule.message(f);
        const base: Diagnostic = {
          kind: "diag",
          code: rule.code,
          path: f.path,
          line: f.line,
          col: f.col,
          message: clipMessage(text, 89),
        };
        out.push(rule.see === undefined ? base : { ...base, see: rule.see });
      }
    } catch (e) {
      out.push(ruleThrew(rule, file.path, e));
    }
  }
  return out;
}

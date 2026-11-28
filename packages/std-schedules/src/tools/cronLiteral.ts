import { type Finding, type RuleDef, defineRule } from "@keel/check";
import { entryError } from "../internal/entryError.ts";
import { callsOf } from "./internal/callsOf.ts";
import { lineCol } from "./internal/lineCol.ts";
import { propOf } from "./internal/propOf.ts";

/**
 * E2551 (std.schedules, k.check registry): a `cron` or `zone` string literal of a `schedule` entry that does not parse,
 * naming the field. No fix; `schedule` also throws it.
 */
export const cronLiteral: RuleDef = defineRule({
  code: "E2551",
  see: "std.schedules",
  message: (f) => String(f.data?.why ?? "cron does not parse"),
  explain:
    "cron has five fields (minute hour day-of-month month day-of-week), each *, n, a-b or a list, with /step; " +
    "zone is UTC or an IANA name. Fix: '@daily' -> '0 0 * * *', 'MON' -> '1'.",
  check: ({ file, ast }): Finding[] => {
    const out: Finding[] = [];
    for (const c of callsOf(ast, "@keel/std-schedules", "schedule")) {
      const table = c.arguments[1];
      if (table?.type !== "ObjectExpression") continue;
      for (const p of table.properties) {
        const e = p.type === "Property" ? p.value : undefined;
        for (const name of ["cron", "zone"]) {
          const lit = propOf(e, name);
          if (lit?.type !== "Literal" || typeof lit.value !== "string") continue;
          const why = name === "cron" ? entryError(lit.value, "UTC") : entryError("* * * * *", lit.value);
          if (why !== undefined) out.push({ path: file.path, ...lineCol(file.source, lit.start), data: { why } });
        }
      }
    }
    return out;
  },
});

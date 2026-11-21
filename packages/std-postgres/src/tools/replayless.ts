import { type Finding, type RuleDef, defineRule } from "@keel/check";
import { callsIn } from "./internal/callsIn.ts";
import { field } from "./internal/field.ts";
import { importedAs } from "./internal/importedAs.ts";
import { lineCol } from "./internal/lineCol.ts";
import { walk } from "./internal/walk.ts";

/**
 * W2456 (std.postgres, k.check registry): `now()`, `current_timestamp`, `clock_timestamp()`, `random()` or
 * `gen_random_uuid()` in the text of a `sql(...)` or `fragment` template, or in a migration outside a `--` comment: a sim
 * run does not replay its answer. One finding per occurrence. No fix.
 */
export const replayless: RuleDef = defineRule({
  code: "W2456",
  see: "std.postgres",
  message: "a clock or random call in SQL text is not replayed under sim",
  explain:
    "now(), current_timestamp, clock_timestamp(), random() and gen_random_uuid() answer from the database, which a " +
    "seed does not fix. Fix: pass ctx.clock.now() or ctx.random.id(brand) as a parameter.",
  check: ({ file, ast }): Finding[] => {
    const sqls = importedAs(ast, "@keel/std-postgres", "sql");
    const fragments = importedAs(ast, "@keel/std-postgres", "fragment");
    if (sqls.size === 0 && fragments.size === 0) return [];
    const out: Finding[] = [];
    walk(ast.body, (n) => {
      if (field(n, "type") !== "TaggedTemplateExpression") return;
      const tag = field(n, "tag");
      const name =
        field(tag, "type") === "Identifier"
          ? fragments.has(String(field(tag, "name")))
          : field(tag, "type") === "CallExpression" &&
            field(field(tag, "callee"), "type") === "Identifier" &&
            sqls.has(String(field(field(tag, "callee"), "name")));
      if (!name) return;
      const quasis = field(field(n, "quasi"), "quasis");
      if (!Array.isArray(quasis)) return;
      for (const q of quasis) {
        const raw = field(field(q, "value"), "raw");
        const start = field(q, "start");
        if (typeof raw === "string" && typeof start === "number")
          for (const at of callsIn(raw, start)) out.push({ path: file.path, ...lineCol(file.source, at) });
      }
    });
    return out;
  },
  sql: (file): Finding[] => {
    const text = file.source.replace(/--[^\n]*/g, (c) => " ".repeat(c.length));
    return callsIn(text, 0).map((at) => ({ path: file.path, ...lineCol(file.source, at) }));
  },
});

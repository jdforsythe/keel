import { type Finding, type RuleDef, defineRule } from "@keel/check";
import { field } from "./internal/field.ts";
import { lineCol } from "./internal/lineCol.ts";
import { walk } from "./internal/walk.ts";

/** A property key's name: an identifier not computed, or a string literal; else null. */
function keyOf(p: unknown): string | null {
  const k = field(p, "key");
  if (field(k, "type") === "Identifier" && field(p, "computed") !== true) return String(field(k, "name"));
  const v = field(k, "type") === "Literal" ? field(k, "value") : undefined;
  return typeof v === "string" ? v : null;
}

/** Whether `e` is a non-empty string literal, or a template with no substitution and non-blank text. */
function isReason(e: unknown): boolean {
  if (field(e, "type") === "Literal") {
    const v = field(e, "value");
    return typeof v === "string" && v.trim() !== "";
  }
  if (field(e, "type") !== "TemplateLiteral") return false;
  const exprs = field(e, "expressions");
  const quasis = field(e, "quasis");
  if (!Array.isArray(exprs) || exprs.length > 0 || !Array.isArray(quasis)) return false;
  const text = field(field(quasis[0], "value"), "cooked");
  return typeof text === "string" && text.trim() !== "";
}

/**
 * E2459 (std.postgres, k.check registry): an object literal passed to a `.transaction(` call that has an `allow`
 * property and no `reason` property whose value is a non-empty string literal. One finding per object, at `allow`.
 * No fix.
 */
export const allowReason: RuleDef = defineRule({
  code: "E2459",
  see: "std.postgres",
  message: "a transaction's allow has no reason written as a non-empty string literal",
  explain:
    "A transaction is serializable unless allow gives some of that up: 'write skew' runs it at repeatable read, " +
    "'lost updates' at read committed. The reason says why the anomaly is safe here, and keel review lists it " +
    "beside the allow, so it is written in place as a literal. Fix: " +
    "db(ctx).transaction(fn, { allow: 'lost updates', reason: 'view counts: one increment in one statement' }), " +
    "or drop allow to keep the serializable default.",
  check: ({ file, ast }): Finding[] => {
    const out: Finding[] = [];
    walk(ast.body, (n) => {
      if (field(n, "type") !== "CallExpression") return;
      const callee = field(n, "callee");
      const prop = field(callee, "property");
      if (field(callee, "type") !== "MemberExpression" || field(callee, "computed") === true) return;
      if (field(prop, "type") !== "Identifier" || field(prop, "name") !== "transaction") return;
      const args = field(n, "arguments");
      if (!Array.isArray(args)) return;
      for (const a of args) {
        if (field(a, "type") !== "ObjectExpression") continue;
        const ps = field(a, "properties");
        if (!Array.isArray(ps)) continue;
        const allow = ps.find((p) => field(p, "type") === "Property" && keyOf(p) === "allow");
        if (allow === undefined) continue;
        const reason = ps.find((p) => field(p, "type") === "Property" && keyOf(p) === "reason");
        if (reason !== undefined && field(reason, "shorthand") !== true && isReason(field(reason, "value"))) continue;
        const at = field(allow, "start");
        out.push({ path: file.path, ...lineCol(file.source, typeof at === "number" ? at : 0) });
      }
    });
    return out;
  },
});

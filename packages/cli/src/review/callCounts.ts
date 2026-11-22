import { type Expression, Visitor, parseSync } from "oxc-parser";
import type { Counts } from "./Counts.ts";

const TESTS = new Set(["expect", "assert", "test", "it"]);

/** The identifier a member chain starts at, or null (a call in the chain ends it: `expect(x).toBe` is null). */
function rootOf(e: Expression): string | null {
  if (e.type === "Identifier") return e.name;
  return e.type === "MemberExpression" ? rootOf(e.object) : null;
}

/**
 * Per k.escapes R1060 and R1108: calls of `expect`, `assert`, `test` or `it` and their members (`expect.soft`,
 * `test.each`), `.pii(` calls, `s.secret(` calls and `guard(` calls; null when the file does not parse.
 */
export function callCounts(path: string, source: string): Counts | null {
  const lang = /\.tsx$/.test(path) ? "tsx" : /\.[cm]?ts$/.test(path) ? "ts" : /\.jsx$/.test(path) ? "jsx" : "js";
  const r = parseSync(path, source, { sourceType: "module", lang });
  if (r.errors.length > 0) return null;
  let tests = 0;
  let pii = 0;
  let secret = 0;
  let guard = 0;
  new Visitor({
    CallExpression: (n) => {
      const c = n.callee;
      const root = rootOf(c);
      if (root !== null && TESTS.has(root)) tests++;
      if (c.type === "Identifier" && c.name === "guard") guard++;
      if (c.type === "MemberExpression" && !c.computed && c.property.type === "Identifier") {
        if (c.property.name === "pii") pii++;
        if (c.property.name === "secret" && c.object.type === "Identifier" && c.object.name === "s") secret++;
      }
    },
  }).visit(r.program);
  return { tests, pii, secret, guard };
}

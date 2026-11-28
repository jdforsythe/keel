import { parseSync } from "oxc-parser";
import type { Argument } from "oxc-parser";
import { describe, expect, it } from "vitest";
import { literalIdOf } from "../src/internal/literalIdOf.ts";

function arg(src: string): Argument | undefined {
  const st = parseSync("a.ts", `f(${src});`).program.body[0];
  if (st === undefined || st.type !== "ExpressionStatement" || st.expression.type !== "CallExpression")
    return undefined;
  return st.expression.arguments[0];
}

describe("literalIdOf", () => {
  it("returns a literal id alone", () => expect(literalIdOf(arg('{ id: "a" }'))).toBe("a"));
  it("is undefined when a later spread could override", () =>
    expect(literalIdOf(arg('{ id: "a", ...p }'))).toBeUndefined());
  it("is undefined with a second id", () => expect(literalIdOf(arg('{ id: "a", id: x }'))).toBeUndefined());
  it("keeps the id when the spread comes first", () => expect(literalIdOf(arg('{ ...p, id: "a" }'))).toBe("a"));
});

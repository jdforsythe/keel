// A deeply nested value, as `JSON.parse` of a request body gives it, never overflows the stack: `parse` never throws
// and `encode` of a valid value never throws (k.schema).
import { describe, expect, it } from "vitest";
import { piiValues, s } from "../src/index.ts";

const DEPTH = 200_000;

/** `[[[...[leaf]...]]]` or `{"a":{"a":...leaf}}`, nested `depth` times, built without recursion. */
const nested = (depth: number, kind: "array" | "object", leaf: unknown): unknown => {
  let v = leaf;
  for (let i = 0; i < depth; i++) v = kind === "array" ? [v] : { a: v };
  return v;
};

/** The same nesting read from JSON text, as a JSON body arrives. */
const fromText = (depth: number, kind: "array" | "object"): unknown =>
  JSON.parse(
    kind === "array" ? `${"[".repeat(depth)}1${"]".repeat(depth)}` : `${'{"a":'.repeat(depth)}1${"}".repeat(depth)}`,
  );

/** How deep `v` nests, through each array's first item or each object's `a`, and the leaf there. */
const depthOf = (v: unknown): { depth: number; leaf: unknown } => {
  let depth = 0;
  let at = v;
  for (; typeof at === "object" && at !== null; depth++) at = Array.isArray(at) ? at[0] : Reflect.get(at, "a");
  return { depth, leaf: at };
};

describe("deep nesting", () => {
  for (const kind of ["array", "object"] as const) {
    it(`s.json() parses and encodes a ${kind} nested ${DEPTH} deep`, () => {
      const J = s.json();
      const v = fromText(DEPTH, kind);
      const r = J.parse(v);
      expect(r.ok).toBe(true);
      const out = J.encode(v);
      expect(out === v).toBe(false);
      expect(depthOf(out)).toEqual({ depth: DEPTH, leaf: 1 });
    });

    it(`s.json() refuses a ${kind} nested ${DEPTH} deep with a non-JSON leaf, with rule type`, () => {
      const r = s.json().parse(nested(DEPTH, kind, Number.NaN));
      expect(r.ok ? [] : r.error.data.issues).toEqual([{ path: [], rule: "type" }]);
    });

    it(`an open object's undeclared ${kind} nested ${DEPTH} deep parses, and one holding __proto__ fails with rule type`, () => {
      const O = s.object({ id: s.int() });
      expect(O.parse({ id: 1, extra: fromText(DEPTH, kind) }).ok).toBe(true);
      const bad = nested(DEPTH, kind, JSON.parse('{"__proto__":1}'));
      const r = O.parse({ id: 1, extra: bad });
      expect(r.ok ? [] : r.error.data.issues.map((i) => i.rule)).toEqual(["type"]);
    });

    it(`piiValues reads a marked s.json() ${kind} nested ${DEPTH} deep`, () => {
      const J = s.object({ body: s.json().pii("content") });
      expect(piiValues(J, { body: fromText(DEPTH, kind) })).toEqual(kind === "array" ? ["1"] : ["a", "1"]);
    });
  }
});

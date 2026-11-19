// Spec: k.schema, clause "`parse(encode(v))` round-trips for every type but `secret`."
// Seed 1337 (fast-check), 100 runs per property. `secret` is excluded by the clause.

import { s } from "@keel/schema";
import { gen } from "@keel/schema/gen";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

const SEED = 1337;
const RUNS = 100;
const CLAUSE = "`parse(encode(v))` round-trips for every type but `secret`.";

// JSON has no negative zero: JSON.stringify(-0) is "0", so the wire form of -0
// is 0. Only -0 is folded into 0; key presence (optional = key may be absent)
// is compared exactly, so absent-vs-undefined is NOT normalised.
const zero = (x: unknown): unknown => {
  if (typeof x === "number") return x === 0 ? 0 : x;
  if (Array.isArray(x)) return x.map(zero);
  if (typeof x === "object" && x !== null) {
    return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, zero(v)]));
  }
  return x;
};

const cases = {
  string: s.string(),
  "string {min,max}": s.string({ min: 2, max: 8 }),
  number: s.number(),
  "number {min,max}": s.number({ min: -10, max: 10 }),
  int: s.int(),
  "int {min,max}": s.int({ min: -5, max: 50 }),
  boolean: s.boolean(),
  "literal string": s.literal("a"),
  "literal number": s.literal(42),
  "literal boolean": s.literal(true),
  enum: s.enum(["admin", "member", "guest"]),
  "id(brand)": s.id("User"),
  "object (open)": s.object({ a: s.string(), b: s.int() }),
  "object {closed:true}": s.object({ a: s.string(), b: s.boolean() }, { closed: true }),
  array: s.array(s.int()),
  "array of object": s.array(s.object({ n: s.number(), t: s.string() })),
  "union(key, variants)": s.union("kind", [
    s.object({ kind: s.literal("circle"), r: s.number({ min: 0, max: 100 }) }),
    s.object({ kind: s.literal("rect"), w: s.int(), h: s.int() }),
  ]),
  "union([members]) overlapping primitives": s.union([s.int(), s.number()]),
  "union([members]) of objects": s.union([
    s.object({ a: s.string() }, { closed: true }),
    s.object({ b: s.int() }, { closed: true }),
    s.object({ c: s.boolean() }),
  ]),
  record: s.record(s.int()),
  json: s.json(),
  "optional() field": s.object({ a: s.string().optional(), b: s.int() }),
  "nullable() field": s.object({ a: s.string().nullable(), b: s.int() }),
  "optional().nullable() field": s.object({ a: s.string().optional().nullable(), b: s.int() }),
  "nullable().optional() field": s.object({ a: s.string().nullable().optional() }),
  "nested: object of array of union": s.object({
    items: s.array(
      s.union("kind", [
        s.object({ kind: s.literal("a"), x: s.int() }),
        s.object({ kind: s.literal("b"), y: s.string().optional() }),
      ]),
    ),
  }),
  "nested: record of nullable": s.record(s.number().nullable()),
  "nested: array of record of optional object": s.array(
    s.record(s.object({ k: s.boolean().optional(), j: s.json().nullable() })),
  ),
  "nested: closed object of member union and enum": s.object(
    { u: s.union([s.string(), s.int(), s.boolean()]), e: s.enum(["x", "y"]).optional() },
    { closed: true },
  ),
};

describe("k.schema conformance: parse(encode(v)) round-trips for every type but secret", () => {
  for (const [name, schema] of Object.entries(cases)) {
    it(`${CLAUSE} [${name}] parse(encode(v)) equals v`, () => {
      fc.assert(
        fc.property(gen(schema), (v) => {
          const r = schema.parse(schema.encode(v));
          expect(r.ok).toBe(true);
          if (r.ok) expect(zero(r.value)).toStrictEqual(zero(v));
        }),
        { seed: SEED, numRuns: RUNS },
      );
    });
    it(`${CLAUSE} [${name}] round-trips through a real JSON string`, () => {
      fc.assert(
        fc.property(gen(schema), (v) => {
          const r = schema.parse(JSON.parse(JSON.stringify(schema.encode(v))));
          expect(r.ok).toBe(true);
          if (r.ok) expect(zero(r.value)).toStrictEqual(zero(v));
        }),
        { seed: SEED, numRuns: RUNS },
      );
    });
  }
});

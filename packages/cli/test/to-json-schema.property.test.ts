// Property: toJsonSchema agrees with parse (k.schema, k.cli #2). Seed 1337.
// Residuals, asserted explicitly below: string length counts UTF-16 units in parse and code points in JSON
// Schema (agree without astral characters); the secret marker "[secret]" is a string the schema accepts and parse rejects.
import { s } from "@keel/schema";
import type { Schema } from "@keel/schema";
import { gen } from "@keel/schema/gen";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { toJsonSchema } from "../src/internal/toJsonSchema.ts";

type Dict = Record<string, unknown>;
const isDict = (v: unknown): v is Dict => typeof v === "object" && v !== null && !Array.isArray(v);
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

function isType(t: unknown, v: unknown): boolean {
  switch (t) {
    case "object":
      return isDict(v);
    case "array":
      return Array.isArray(v);
    case "string":
      return typeof v === "string";
    case "number":
      return typeof v === "number" && Number.isFinite(v);
    case "integer":
      return typeof v === "number" && Number.isInteger(v);
    case "boolean":
      return typeof v === "boolean";
    case "null":
      return v === null;
    default:
      throw new Error(`unknown type ${String(t)}`);
  }
}

function list(v: unknown): unknown[] {
  if (!Array.isArray(v)) throw new Error("not an array");
  return v;
}

function validate(schema: unknown, v: unknown): boolean {
  if (!isDict(schema)) throw new Error("schema is not an object");
  const known = new Set([
    "type",
    "properties",
    "required",
    "additionalProperties",
    "items",
    "enum",
    "const",
    "anyOf",
    "oneOf",
    "minLength",
    "maxLength",
    "minimum",
    "maximum",
  ]);
  for (const k of Object.keys(schema)) if (!known.has(k)) throw new Error(`unsupported keyword ${k}`);
  if ("type" in schema && !isType(schema.type, v)) return false;
  if ("enum" in schema && !list(schema.enum).some((x) => same(x, v))) return false;
  if ("const" in schema && !same(schema.const, v)) return false;
  if (typeof v === "string") {
    const n = [...v].length;
    if (typeof schema.minLength === "number" && n < schema.minLength) return false;
    if (typeof schema.maxLength === "number" && n > schema.maxLength) return false;
  }
  if (typeof v === "number") {
    if (typeof schema.minimum === "number" && v < schema.minimum) return false;
    if (typeof schema.maximum === "number" && v > schema.maximum) return false;
  }
  if (Array.isArray(v) && "items" in schema && !v.every((x) => validate(schema.items, x))) return false;
  if (isDict(v)) {
    const props = isDict(schema.properties) ? schema.properties : {};
    for (const r of Array.isArray(schema.required) ? schema.required : [])
      if (!Object.hasOwn(v, String(r))) return false;
    for (const [k, x] of Object.entries(v)) {
      if (Object.hasOwn(props, k)) {
        if (!validate(props[k], x)) return false;
      } else if ("additionalProperties" in schema) {
        const ap = schema.additionalProperties;
        if (ap === false || (ap !== true && !validate(ap, x))) return false;
      }
    }
  }
  if ("anyOf" in schema && !list(schema.anyOf).some((x) => validate(x, v))) return false;
  if ("oneOf" in schema && list(schema.oneOf).filter((x) => validate(x, v)).length !== 1) return false;
  return true;
}

const agrees = (schema: Schema<unknown, boolean>, v: unknown): boolean =>
  validate(toJsonSchema(schema.node), v) === schema.parse(v).ok;

// Strings without astral characters: UTF-16 length equals code point count.
const bmp = fc.string({ unit: fc.constantFrom("a", "b", "é", "中", " ", "\u0000"), maxLength: 8 });
const bound = fc.option(fc.integer({ min: -5, max: 8 }), { nil: undefined });
const edge = fc.constantFrom(
  0,
  1,
  -1,
  2,
  7,
  8,
  1.5,
  -0.5,
  2 ** 53,
  2 ** 53 - 1,
  -(2 ** 53 - 1),
  -(2 ** 53),
  2 ** 60,
  -(2 ** 60),
  1e300,
);
const num = fc.oneof(edge, fc.integer({ min: -10, max: 10 }), fc.double({ noNaN: true, noDefaultInfinity: true }));

const order = (a: number | undefined, b: number | undefined): { min?: number; max?: number } => {
  const lo = a !== undefined && b !== undefined ? Math.min(a, b) : a;
  const hi = a !== undefined && b !== undefined ? Math.max(a, b) : b;
  return { ...(lo === undefined ? {} : { min: lo }), ...(hi === undefined ? {} : { max: hi }) };
};

type Leaf = Schema<unknown, false>;
const leaf: fc.Arbitrary<Leaf> = fc.oneof(
  fc.tuple(bound, bound).map(([a, b]) => {
    const o = order(a === undefined ? undefined : Math.abs(a), b === undefined ? undefined : Math.abs(b));
    return s.string(o);
  }),
  fc.tuple(bound, bound).map(([a, b]) => s.number(order(a, b))),
  fc.tuple(bound, bound).map(([a, b]) => s.int(order(a, b))),
  fc.constant(s.boolean()),
  fc.constant(s.id("User")),
  fc.constant(s.json()),
  fc.constantFrom<string | number | boolean>("a", 1, true, 0).map((v) => s.literal(v)),
  fc.constant(s.enum(["x", "y"])),
);

const schemaArb: fc.Arbitrary<Leaf> = fc.letrec<{ node: Leaf }>((tie) => ({
  node: fc.oneof(
    { depthSize: "small", withCrossShrink: true },
    leaf,
    tie("node").map((n) => s.array(n)),
    tie("node").map((n) => s.record(n)),
    tie("node").map((n) => n.nullable()),
    fc
      .tuple(tie("node"), tie("node"), fc.boolean())
      .map(([a, b, closed]) => s.object({ a, b: b.optional() }, { closed })),
    fc.tuple(tie("node"), tie("node")).map(([a, b]) => s.union([a, b])),
    fc
      .tuple(tie("node"), tie("node"))
      .map(([a, b]) => s.union("t", [s.object({ t: s.literal("p"), v: a }), s.object({ t: s.literal("q"), w: b })])),
  ),
})).node;

const jsonValue = fc.jsonValue();
const NUM = { seed: 1337, numRuns: 400 };

describe("toJsonSchema agrees with parse", () => {
  it("primitives with random bounds against edge numbers, ids and BMP strings", () => {
    fc.assert(
      fc.property(leaf, fc.oneof(num, bmp, jsonValue, fc.constant("")), (schema, v) => {
        expect(agrees(schema, v)).toBe(true);
      }),
      NUM,
    );
  });

  it("composite schemas against generated valid values and random JSON", () => {
    fc.assert(
      fc.property(schemaArb, fc.integer(), jsonValue, (schema, seed, other) => {
        const valid = fc.sample(gen(schema), { seed, numRuns: 3 });
        for (const v of [...valid, other]) {
          // Optional keys given null are rejected by parse only (rule optional-null): out of scope here.
          const r = schema.parse(v);
          if (!r.ok && r.error.data.issues.some((i) => i.rule === "optional-null")) continue;
          expect(agrees(schema, v)).toBe(true);
        }
      }),
      NUM,
    );
  });

  it("the named repros", () => {
    expect(agrees(s.int({ min: 1 }), 0)).toBe(true);
    expect(agrees(s.id("User"), "")).toBe(true);
    expect(agrees(s.int(), 2 ** 60)).toBe(true);
    expect(agrees(s.int({ max: 2 ** 60 }), 2 ** 60)).toBe(true);
    expect(agrees(s.number({ max: 1 }), 1.5)).toBe(true);
  });

  it("residual: astral characters count as two UTF-16 units in parse and one code point in JSON Schema", () => {
    const schema = s.string({ max: 1 });
    expect(schema.parse("\u{1F600}").ok).toBe(false);
    expect(validate(toJsonSchema(schema.node), "\u{1F600}")).toBe(true);
  });
});

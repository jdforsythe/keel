// Seed 1337. k.privacy marks: properties beyond conformance.
import fc from "fast-check";
import { expect, test } from "vitest";
import { gen } from "../src/gen.ts";
import { type Schema, piiPaths, piiValues, s } from "../src/index.ts";

const opts = { seed: 1337, numRuns: 100 };

const leaf = fc.constantFrom<Schema<unknown>>(s.string(), s.int(), s.number(), s.boolean(), s.enum(["a", "b"]));
const unmarked: fc.Arbitrary<Schema<unknown>> = fc.letrec<{ node: Schema<unknown> }>((tie) => ({
  node: fc.oneof(
    { depthSize: "small", withCrossShrink: true },
    leaf,
    tie("node").map((n) => s.array(n)),
    tie("node").map((n) => s.record(n)),
    tie("node").map((n) => n.nullable()),
    fc.dictionary(fc.stringMatching(/^[a-z]{1,4}$/), tie("node"), { maxKeys: 3 }).map((shape) => s.object(shape)),
  ),
})).node;

test("piiValues of a value with no marked path is empty", () => {
  fc.assert(
    fc.property(
      unmarked.chain((schema) => fc.tuple(fc.constant(schema), gen(schema))),
      ([schema, value]) => {
        expect(piiPaths(schema)).toEqual([]);
        expect(piiValues(schema, schema.encode(value))).toEqual([]);
      },
    ),
    opts,
  );
});

test("a leaf under nested marks takes the nearest mark's class", () => {
  const schema = s.object({ a: s.object({ b: s.string().pii("contact"), c: s.int() }).pii("location") });
  expect(piiPaths(schema)).toEqual([
    { path: "a.b", class: "contact" },
    { path: "a.c", class: "location" },
  ]);
});

test("piiValues are distinct, and a secret's marker is not one", () => {
  const schema = s.object({ x: s.array(s.string()).pii("content"), k: s.secret(s.string()).pii("identifier") });
  expect(piiValues(schema, { x: ["a", "a", "b"], k: "[secret]" })).toEqual(["a", "b"]);
});

test("a mark survives .optional() and .nullable() in either order, and keeps a format's predicate", () => {
  const Even = s.format("even", s.int(), { check: (n) => n % 2 === 0, gen: { from: s.int(), map: (n) => n * 2 } });
  const schema = s.object({ a: s.string().optional().pii("name").nullable(), e: Even.pii("identifier") });
  expect(piiPaths(schema)).toEqual([
    { path: "a", class: "name" },
    { path: "e", class: "identifier" },
  ]);
  expect(schema.parse({ e: 3 }).ok).toBe(false);
  expect(schema.parse({ a: null, e: 4 }).ok).toBe(true);
  expect(schema.doc()).toBe("a?: string pii(name) | null\ne: even pii(identifier)");
});

test("union and record paths: variants share a path once; a record value is `*`", () => {
  const schema = s.object({
    u: s.union("t", [
      s.object({ t: s.literal("a"), v: s.string().pii("name") }),
      s.object({ t: s.literal("b"), v: s.string().pii("name") }),
    ]),
    r: s.record(s.int().pii("financial")),
  });
  expect(piiPaths(schema)).toEqual([
    { path: "u.v", class: "name" },
    { path: "r.*", class: "financial" },
  ]);
  expect(piiValues(schema, { u: { t: "b", v: "Ada" }, r: { x: 3 } })).toEqual(["Ada", "3"]);
});

test("a marked object keeps decodeStrings", () => {
  const schema = s.object({ n: s.int() }).pii("identifier");
  expect(schema.decodeStrings({ n: "4" })).toEqual(s.object({ n: s.int() }).decodeStrings({ n: "4" }));
  expect(schema.doc()).toBe("n: int pii(identifier)");
});

// fast-check seed: 1337
import { type ObjectSchema, type Schema, ok, s } from "@keel/schema";
import { gen } from "@keel/schema/gen";
import fc from "fast-check";
import { expect, it } from "vitest";
import { toFormData } from "../src/index.ts";

const SEED = 1337;

// Primitive field schemas decodeStrings can carry. Optional strings need min >= 1: '' for an optional key is absent.
const primitive: fc.Arbitrary<Schema<unknown, boolean>> = fc.oneof(
  fc.nat(3).map((min) => s.string({ min })),
  fc.integer({ min: 1, max: 3 }).map((min) => s.string({ min }).optional()),
  fc.constant(s.number()),
  fc.constant(s.number().optional()),
  fc.constant(s.int()),
  fc.constant(s.int().optional()),
  fc.constant(s.boolean()),
  fc.constant(s.boolean().optional()),
  fc.constant(s.enum(["a", "b", "1", "true"])),
  fc.constant(s.enum(["x", "y"]).optional()),
  fc.constantFrom(s.literal("on"), s.literal(7), s.literal(true), s.literal(false)),
  fc.constant(s.id("User")),
);
const key = fc.stringMatching(/^[a-z][a-z0-9_]{0,7}$/).filter((k) => !["constructor", "prototype"].includes(k));
const objectSchema: fc.Arbitrary<ObjectSchema<object>> = fc
  .dictionary(key, primitive, { minKeys: 0, maxKeys: 8, noNullPrototype: true })
  .map((shape) => s.object(shape));
// A nested object with no entries at all decodes as absent, so each child keeps one required string key.
const nested: fc.Arbitrary<ObjectSchema<object>> = fc
  .tuple(
    fc.dictionary(key, primitive, { maxKeys: 4, noNullPrototype: true }),
    key,
    fc.dictionary(key, primitive, { maxKeys: 4, noNullPrototype: true }),
  )
  .map(([shape, inner, child]) => s.object({ ...shape, [`${inner}_n`]: s.object({ ...child, k_req: s.string() }) }));

it("decodeStrings(toFormData(schema, v)) is ok(v) for generated object schemas of primitives", () => {
  fc.assert(
    fc.property(
      objectSchema.chain((schema) => gen(schema).map((value) => ({ schema, value }))),
      ({ schema, value }) => {
        expect(schema.decodeStrings(toFormData(schema, value))).toEqual(ok(value));
      },
    ),
    { seed: SEED, numRuns: 300 },
  );
});

it("round-trips one level of nesting through dotted keys", () => {
  fc.assert(
    fc.property(
      nested.chain((schema) => gen(schema).map((value) => ({ schema, value }))),
      ({ schema, value }) => {
        expect(schema.decodeStrings(toFormData(schema, value))).toEqual(ok(value));
      },
    ),
    { seed: SEED, numRuns: 200 },
  );
});

it("round-trips arrays of leaves through repeated keys", () => {
  const Tags = s.object({ tags: s.array(s.enum(["a", "b"])), n: s.array(s.int()) });
  fc.assert(
    fc.property(
      gen(Tags).filter((v) => v.tags.length > 0 && v.n.length > 0),
      (value) => {
        const fd = toFormData(Tags, value);
        expect(fd.getAll("tags")).toEqual(value.tags);
        expect(Tags.decodeStrings(fd)).toEqual(ok(value));
      },
    ),
    { seed: SEED, numRuns: 100 },
  );
});

it("encodes -0, false, and absent optionals as the decode table expects", () => {
  const S = s.object({ n: s.number(), b: s.boolean(), o: s.string({ min: 1 }).optional() });
  const fd = toFormData(S, { n: -0, b: false });
  expect([...fd.entries()]).toEqual([
    ["n", "-0"],
    ["b", "false"],
  ]);
  expect(S.decodeStrings(fd)).toEqual(ok({ n: -0, b: false }));
});

it("throws for a value that does not fit, like encode", () => {
  const S = s.object({ n: s.int() });
  const bad: unknown = { n: 1.5 };
  const loose: (schema: ObjectSchema<object>, v: unknown) => FormData = (schema, v) =>
    toFormData(schema, typeof v === "object" && v !== null ? v : {});
  expect(() => loose(S, bad)).toThrow(/does not fit/);
});

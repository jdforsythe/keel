// `fake` (std.sessions redaction): the generated value that stands in for a redacted one. It is the smallest value
// its schema parses, with strings, ids and enum members drawn from the given random source.
// Seed 1337
import { type Schema, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { fake } from "../src/internal/fake.ts";

/** A random source that walks `values` in order, then repeats. */
const walk = (values: readonly number[]): (() => number) => {
  let i = 0;
  return () => values[i++ % values.length] ?? 0;
};
const zero = (): number => 0;
const high = (): number => 0.999;
const of = (schema: Schema<unknown, boolean>, rand: () => number = zero): unknown => fake(schema.node, rand);

describe("fake: leaves", () => {
  test("a string is lowercase letters drawn from rand, 8 long unless its bounds say otherwise", () => {
    expect(of(s.string())).toBe("aaaaaaaa");
    expect(of(s.string(), high)).toBe("zzzzzzzz");
    expect(of(s.string(), walk([0, 1 / 26, 2 / 26, 25 / 26]))).toBe("abczabcz");
    expect(of(s.string({ max: 3 }))).toBe("aaa");
    expect(of(s.string({ max: 8 }))).toBe("aaaaaaaa");
    expect(of(s.string({ max: 20 }))).toBe("aaaaaaaa");
    expect(of(s.string({ min: 12 }))).toBe("aaaaaaaaaaaa");
    expect(of(s.string({ min: 2, max: 40 }))).toBe("aaaaaaaa");
    expect(of(s.string({ max: 0 }))).toBe("");
  });

  test("a number is its min, else 0; an int is the first whole number from its min; a max below that wins", () => {
    expect(of(s.number())).toBe(0);
    expect(of(s.number({ min: 2.5 }))).toBe(2.5);
    expect(of(s.number({ min: -3, max: 9 }))).toBe(-3);
    expect(of(s.number({ max: -4 }))).toBe(-4);
    expect(of(s.number({ max: 0 }))).toBe(0);
    expect(of(s.number({ max: 7 }))).toBe(0);
    expect(of(s.int())).toBe(0);
    expect(of(s.int({ min: 2.5, max: 9 }))).toBe(3);
    expect(of(s.int({ min: 4 }))).toBe(4);
    expect(of(s.int({ max: -2 }))).toBe(-2);
    expect(of(s.int({ min: 1, max: 1 }))).toBe(1);
  });

  test("a boolean is false, a literal is itself, json and a nullable are null", () => {
    expect(of(s.boolean())).toBe(false);
    expect(of(s.literal("tx"))).toBe("tx");
    expect(of(s.literal(7))).toBe(7);
    expect(of(s.literal(true))).toBe(true);
    expect(of(s.json())).toBeNull();
    expect(of(s.string().nullable())).toBeNull();
  });

  test("an enum member is drawn from rand across the whole list", () => {
    const state = s.enum(["loading", "ready", "error"]);
    expect(of(state, zero)).toBe("loading");
    expect(of(state, walk([0.34]))).toBe("ready");
    expect(of(state, high)).toBe("error");
  });

  test("an id is 32 hex characters drawn from rand", () => {
    expect(of(s.id("Card"))).toBe("0".repeat(32));
    expect(of(s.id("Card"), high)).toBe("f".repeat(32));
    expect(of(s.id("Card"), walk([0, 10 / 16]))).toBe("0a".repeat(16));
  });
});

describe("fake: wrappers and containers", () => {
  test("an optional and a secret give their inner value", () => {
    expect(of(s.string({ max: 2 }).optional())).toBe("aa");
    expect(of(s.secret(s.int({ min: 5 })))).toBe(5);
    expect(of(s.secret(s.string({ max: 4 })), high)).toBe("zzzz");
  });

  test("an array is empty, a record is empty", () => {
    expect(of(s.array(s.string()))).toEqual([]);
    expect(of(s.record(s.int()))).toEqual({});
  });

  test("an object has every required key, faked, and no optional key", () => {
    const card = s.object({
      number: s.string({ max: 4 }),
      cvc: s.int({ min: 100 }),
      note: s.string().optional(),
      owner: s.object({ name: s.string({ max: 1 }), vip: s.boolean().optional() }),
    });
    expect(of(card, high)).toEqual({ number: "zzzz", cvc: 100, owner: { name: "z" } });
    expect(of(s.object({}))).toEqual({});
    expect(of(s.object({ only: s.string().optional() }))).toEqual({});
  });

  test("a union gives its first variant, a member list its first member", () => {
    const event = s.union("kind", [
      s.object({ kind: s.literal("nav"), href: s.string({ max: 2 }) }),
      s.object({ kind: s.literal("net"), online: s.boolean() }),
    ]);
    expect(of(event)).toEqual({ kind: "nav", href: "aa" });
    expect(of(s.union([s.int({ min: 3 }), s.string()]))).toBe(3);
    expect(fake({ kind: "union", key: "kind", variants: [] }, zero)).toBeNull();
    expect(fake({ kind: "anyOf", members: [] }, zero)).toBeNull();
  });

  test("a format gives a value its check accepts, made from the generator's source; else its base's value", () => {
    const Slug = s.format("slug", s.string(), {
      check: (v) => /^[a-z]+-[a-z]+$/.test(v),
      gen: { from: s.string({ min: 2, max: 3 }), map: (v) => `${v}-${v}` },
    });
    expect(of(Slug, high)).toBe("zzz-zzz");
    expect(Slug.parse(of(Slug)).ok).toBe(true);
    const Never = s.format("never", s.string({ max: 2 }), {
      check: () => false,
      gen: { from: s.string(), map: (v) => v },
    });
    expect(of(Never)).toBe("aa");
    expect(fake({ kind: "format", name: "loose", base: s.int({ min: 6 }).node }, zero)).toBe(6);
  });
});

describe("fake: properties", () => {
  const leaf = fc.oneof(
    fc
      .tuple(fc.integer({ min: 0, max: 12 }), fc.integer({ min: 0, max: 12 }))
      .map(([a, b]) => s.string({ min: Math.min(a, b), max: Math.max(a, b) })),
    fc
      .tuple(fc.integer({ min: -50, max: 50 }), fc.integer({ min: -50, max: 50 }))
      .map(([a, b]) => s.int({ min: Math.min(a, b), max: Math.max(a, b) })),
    fc.integer({ min: -50, max: 50 }).map((max) => s.number({ max })),
    fc.constant(s.boolean()),
    fc.constant(s.enum(["a", "b", "c", "d"])),
    fc.constant(s.id("X")),
    fc.constant(s.json()),
    fc.constant(s.string().nullable()),
    fc.constant(s.secret(s.string({ min: 1 }))),
    fc.constant(s.array(s.int())),
    fc.constant(s.record(s.string())),
  );
  const rands = fc.array(fc.double({ min: 0, max: 0.999999, noNaN: true }), { minLength: 1, maxLength: 40 });

  test("the value parses with its schema, whatever rand draws", () => {
    fc.assert(
      fc.property(leaf, leaf, rands, (a, b, draws) => {
        const schema = s.object({ a, b, c: s.object({ inner: a, skipped: b.optional() }) });
        const value = fake(schema.node, walk(draws));
        expect(schema.parse(value).ok).toBe(true);
        expect(a.parse(fake(a.node, walk(draws))).ok).toBe(true);
      }),
      { seed: 1337, numRuns: 100 },
    );
  });

  test("the same draws give the same value", () => {
    fc.assert(
      fc.property(leaf, rands, (schema, draws) => {
        expect(fake(schema.node, walk(draws))).toEqual(fake(schema.node, walk(draws)));
      }),
      { seed: 1337, numRuns: 100 },
    );
  });
});

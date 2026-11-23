// k.forms, k.server: FormData that fails an action's input schema answers `keel.fields`, one message per path, the
// message made from the broken rule and the schema node at that path.
import { s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";

const SEED = 1337;
const Slug = s.format("slug", s.string({ min: 3 }), {
  check: (v) => /^[a-z-]+$/.test(v),
  gen: { from: s.int({ min: 0, max: 9 }), map: (n) => `s-${"a".repeat(n)}` },
});
const Input = s.object({
  one: s.string({ min: 1 }),
  two: s.string({ min: 2, max: 3 }),
  cap: s.string({ max: 1 }),
  slug: Slug,
  short: Slug,
  tags: s.array(s.string({ min: 2 })),
  map: s.record(s.int()),
  token: s.secret(s.string()),
  n: s.number(),
  i: s.int(),
  b: s.boolean(),
  lit: s.literal("x"),
  en: s.enum(["a", "b"]),
  id: s.id("User"),
  opt: s.int().optional(),
  nul: s.string({ min: 2 }).nullable(),
  closed: s.object({ a: s.int() }, { closed: true }),
  u: s.union("kind", [s.object({ kind: s.literal("a"), v: s.string({ min: 4 }) }), s.object({ kind: s.literal("b") })]),
});
const bad = {
  one: "",
  two: "a",
  cap: "xx",
  slug: "BAD",
  short: "ab",
  tags: ["ok", "x", "ok", "ok", "ok", "ok", "ok", "ok", "ok", "ok", "y"],
  map: { k: "v" },
  n: "1",
  i: 1.5,
  b: "t",
  lit: "y",
  en: "c",
  id: 5,
  opt: null,
  nul: "a",
  closed: { a: 1, zz: 2 },
  u: { kind: "a", v: "abc" },
};

/** `fieldsError` of a router loaded afresh over what `schema` says of `value`. */
const fields = async (schema: typeof Input, value: unknown): Promise<unknown> => {
  vi.resetModules();
  const { fieldsError } = await import("../src/internal/index.ts");
  const r = schema.parse(value);
  if (r.ok) throw new Error("the value parses");
  return fieldsError(schema.node, r.error);
};

describe("fieldsError", () => {
  it("gives one message per failing path, from the rule and the node there", async () => {
    expect(await fields(Input, bad)).toEqual({
      code: "keel.fields",
      message: "keel.fields",
      data: {
        one: "Required",
        two: "Must be at least 2 characters",
        cap: "Must be at most 1 character",
        slug: "Invalid value",
        short: "Must be at least 3 characters",
        "tags.1": "Must be at least 2 characters",
        "tags.10": "Must be at least 2 characters",
        "map.k": "Must be a number",
        token: "Required",
        n: "Must be a number",
        i: "Must be a whole number",
        b: "Must be true or false",
        lit: 'Must be "x"',
        en: "Must be one of: a, b",
        id: "Must be text",
        opt: "Must not be null",
        nul: "Must be at least 2 characters",
        "closed.zz": "Unknown field",
        "u.v": "Must be at least 4 characters",
      },
    });
  });

  it("names a length over the maximum, a number that is not finite, a wrong type and an unknown variant", async () => {
    const got = await fields(Input, {
      ...bad,
      two: "abcd",
      n: Number.POSITIVE_INFINITY,
      tags: "no",
      u: { kind: "zz" },
    });
    expect(Reflect.get(Object(got), "data")).toMatchObject({
      two: "Must be at most 3 characters",
      n: "Must be a finite number",
      tags: "Invalid value",
      "u.kind": "Invalid choice",
    });
  });

  it("counts characters in the singular for one and the plural otherwise", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 6 }), async (max) => {
        vi.resetModules();
        const { fieldsError } = await import("../src/internal/index.ts");
        const schema = s.object({ text: s.string({ max }), deep: s.string({ min: max + 1 }) });
        const r = schema.parse({ text: "x".repeat(max + 1), deep: "x".repeat(max) });
        if (r.ok) throw new Error("the value parses");
        expect(fieldsError(schema.node, r.error).data).toEqual({
          text: `Must be at most ${max} character${max === 1 ? "" : "s"}`,
          deep: `Must be at least ${max + 1} characters`,
        });
      }),
      { seed: SEED, numRuns: 12 },
    );
  });
});

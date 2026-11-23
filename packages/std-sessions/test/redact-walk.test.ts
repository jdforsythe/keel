// `redact` (std.sessions Redaction), node by node: how it walks nullable, optional, format, record and union
// schemas, what strings mode leaves alone, and how a generated value depends on its path.
// Seed 1337
import { type JsonValue, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { redact } from "../src/redact.ts";

const plain = { paths: [], seed: 7, salt: "tx:a.b" };
const strings = (except: readonly string[] = []) => ({ ...plain, strings: { except } });

describe("redact: secrets under wrappers", () => {
  test("a nullable secret that is null stays null; one with a value is generated", () => {
    const S = s.object({ pin: s.secret(s.string({ min: 4, max: 4 })).nullable() });
    expect(redact(S, { pin: null }, plain)).toEqual({ pin: null });
    const out = redact(S, { pin: "[secret]" }, plain);
    expect(out).toEqual({ pin: expect.stringMatching(/^[a-z]{4}$/) });
  });

  test("an optional secret is generated when present, even from null", () => {
    const S = s.object({ pin: s.secret(s.int({ min: 9 })).optional() });
    expect(redact(S, { pin: "[secret]" }, plain)).toEqual({ pin: 9 });
    expect(redact(S, { pin: null }, plain)).toEqual({ pin: 9 });
    expect(redact(S, {}, plain)).toEqual({});
  });

  test("a record's values are walked with their schema", () => {
    const S = s.record(s.secret(s.int({ min: 3 })));
    expect(redact(S, { a: "[secret]", b: "[secret]" }, plain)).toEqual({ a: 3, b: 3 });
  });

  test("a format is walked as its base", () => {
    const Card = s.format("card", s.object({ holder: s.string(), cvc: s.secret(s.int({ min: 100 })) }), {
      check: () => true,
      gen: { from: s.object({ holder: s.string(), cvc: s.secret(s.int({ min: 100 })) }), map: (v) => v },
    });
    expect(redact(Card, { holder: "Ada", cvc: "[secret]" }, plain)).toEqual({ holder: "Ada", cvc: 100 });
    expect(redact(Card, { holder: "Ada", cvc: "[secret]" }, strings())).toEqual({ holder: "xxx", cvc: 100 });
    const Slug = s.format("slug", s.string(), { check: () => true, gen: { from: s.string(), map: (v) => v } });
    expect(redact(s.object({ slug: Slug }), { slug: "a-b" }, strings())).toEqual({ slug: "xxx" });
    expect(redact(s.object({ slug: Slug }), { slug: "a-b" }, plain)).toEqual({ slug: "a-b" });
  });

  test("a pii record's keys become x0, x1, ... with or without a `found` callback", () => {
    const S = s.object({ by: s.record(s.number()).pii("contact") });
    expect(redact(S, { by: { "ada@x.test": 1, "bob@x.test": 2 } }, plain)).toEqual({ by: { x0: 1, x1: 2 } });
    const found: JsonValue[] = [];
    redact(S, { by: { "ada@x.test": 1 } }, { ...plain, found: (v) => found.push(v) });
    expect(found).toEqual(["ada@x.test"]);
  });
});

describe("redact: unions", () => {
  const U = s.union("t", [
    s.object({ t: s.literal("a"), v: s.string() }),
    s.object({ t: s.literal("b"), w: s.secret(s.int({ min: 5 })), v: s.id("V") }),
  ]);

  test("the variant is the one whose tag the value carries, not the first", () => {
    expect(redact(U, { t: "b", w: "[secret]", v: "id-1" }, strings())).toEqual({ t: "b", w: 5, v: "id-1" });
    expect(redact(U, { t: "a", v: "text" }, strings())).toEqual({ t: "a", v: "xxxx" });
  });

  test("a value with an unknown tag, or none, comes back as it is", () => {
    expect(redact(U, { t: "z", v: "text" }, strings())).toEqual({ t: "z", v: "text" });
    expect(redact(U, { v: "text" }, strings())).toEqual({ v: "text" });
    expect(redact(U, "text", strings())).toBe("text");
    expect(redact(U, null, plain)).toBeNull();
  });
});

describe("redact: strings mode", () => {
  test("only strings change: numbers, booleans and null under s.json() stay", () => {
    const value = { n: 5, b: true, z: null, t: "abc", l: [1, "de", false], o: { k: "f", m: 0 } };
    expect(redact(s.json(), value, strings())).toEqual({
      n: 5,
      b: true,
      z: null,
      t: "xxx",
      l: [1, "xx", false],
      o: { k: "x", m: 0 },
    });
    expect(redact(s.json(), value, plain)).toEqual(value);
  });

  test("an except path covers the value at it and everything under it, and nothing beside it", () => {
    const S = s.object({
      card: s.object({ number: s.string(), holder: s.object({ name: s.string() }) }),
      note: s.string(),
      tags: s.array(s.string()),
    });
    const value = { card: { number: "4242", holder: { name: "Ada" } }, note: "hi", tags: ["a1", "b2"] };
    expect(redact(S, value, strings(["card"]))).toEqual({ ...value, note: "xx", tags: ["xx", "xx"] });
    expect(redact(S, value, strings(["card.holder"]))).toEqual({
      card: { number: "xxxx", holder: { name: "Ada" } },
      note: "xx",
      tags: ["xx", "xx"],
    });
    expect(redact(S, value, strings(["tags.*", "note"]))).toEqual({
      card: { number: "xxxx", holder: { name: "xxx" } },
      note: "hi",
      tags: ["a1", "b2"],
    });
    expect(redact(S, value, strings(["tags.1"]))).toEqual({
      card: { number: "xxxx", holder: { name: "xxx" } },
      note: "xx",
      tags: ["xx", "b2"],
    });
    expect(redact(S, value, strings(["card.number.digits", "number", "holder.name"]))).toEqual({
      card: { number: "xxxx", holder: { name: "xxx" } },
      note: "xx",
      tags: ["xx", "xx"],
    });
  });

  test("property: with no except path, no letter of a recorded string is left and lengths hold", () => {
    const S = s.object({ a: s.string(), deep: s.object({ list: s.array(s.string()) }), meta: s.json() });
    const word = fc.stringMatching(/^[A-Z]{1,12}$/);
    fc.assert(
      fc.property(word, fc.array(word, { maxLength: 4 }), word, (a, list, m) => {
        const out = redact(S, { a, deep: { list }, meta: { m } }, strings());
        expect(out).toEqual({
          a: "x".repeat(a.length),
          deep: { list: list.map((w) => "x".repeat(w.length)) },
          meta: { m: "x".repeat(m.length) },
        });
      }),
      { seed: 1337, numRuns: 100 },
    );
  });
});

describe("redact: generated values", () => {
  test("a generated value is seeded by its dotted path: two paths that read alike without the dot differ", () => {
    const S = s.object({
      x: s.object({ ab: s.string({ min: 16 }) }),
      xa: s.object({ b: s.string({ min: 16 }) }),
    });
    const out = redact(S, { x: { ab: "one" }, xa: { b: "two" } }, { paths: ["x.ab", "xa.b"], seed: 1, salt: "tx:p" });
    const parsed = S.parse(out);
    if (!parsed.ok) throw new Error("the redacted value parses");
    expect(parsed.value.x.ab).toMatch(/^[a-z]{16}$/);
    expect(parsed.value.xa.b).toMatch(/^[a-z]{16}$/);
    expect(parsed.value.x.ab).not.toBe(parsed.value.xa.b);
  });

  test("a matched path under a typed field gives the field's generated value, and `found` hears the original", () => {
    const S = s.object({ qty: s.int({ min: 2 }), kind: s.enum(["only"]), flag: s.boolean() });
    const found: JsonValue[] = [];
    const out = redact(
      S,
      { qty: 40, kind: "only", flag: true },
      { paths: ["qty", "flag"], seed: 0, salt: "tx:p", found: (v) => found.push(v) },
    );
    expect(out).toEqual({ qty: 2, kind: "only", flag: false });
    expect(found).toEqual([40, true]);
  });
});

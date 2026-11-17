// Seed 1337. The internal read @keel/server takes of a decoded action input: each Secret under it, revealed, as text.
import fc from "fast-check";
import { expect, test } from "vitest";
import { Secret } from "../src/Secret.ts";
import { s } from "../src/index.ts";
import type { Node } from "../src/internal/Node.ts";
import { secretValues } from "../src/internal/index.ts";

const parsed = (schema: { parse(x: unknown): { ok: true; value: unknown } | { ok: false } }, x: unknown): unknown => {
  const r = schema.parse(x);
  if (!r.ok) throw new Error("the fixture does not parse");
  return r.value;
};
const text = s.secret(s.string());
const json: Node = { kind: "json" };

test("reads a root secret, and secrets in nested objects and arrays in the order they stand", () => {
  expect(secretValues(parsed(text, "root-value"))).toEqual(["root-value"]);
  const schema = s.object({
    a: text,
    plain: s.string(),
    b: s.object({ c: text, d: s.array(s.object({ e: text })) }),
    f: s.record(text),
  });
  const value = parsed(schema, {
    a: "first",
    plain: "not-a-secret",
    b: { c: "second", d: [{ e: "third" }, { e: "fourth" }] },
    f: { g: "fifth" },
  });
  expect(secretValues(value)).toEqual(["first", "second", "third", "fourth", "fifth"]);
});

test("gives a number as String() does and leaves a boolean out", () => {
  const value = parsed(s.object({ n: s.secret(s.number()), yes: s.secret(s.boolean()), no: s.secret(s.boolean()) }), {
    n: 42.5,
    yes: true,
    no: false,
  });
  expect(secretValues(value)).toEqual(["42.5"]);
  expect(secretValues(parsed(s.secret(s.int()), 0))).toEqual(["0"]);
});

test("gives nothing where no secret stands: plain data, primitives, null and the marker", () => {
  expect(secretValues({ a: "x", b: [1, { c: "y" }], d: null })).toEqual([]);
  for (const v of ["text", 7, true, null, undefined, "[secret]"]) expect(secretValues(v)).toEqual([]);
});

test("leaves out the empty string and a null secret, and keeps the ones beside them", () => {
  const value = parsed(s.object({ a: text, b: s.secret(s.string().nullable()), c: text }), {
    a: "",
    b: null,
    c: "kept",
  });
  expect(secretValues(value)).toEqual(["kept"]);
});

test("a secret holding an object or an array gives each string and number in it, at any depth, and no boolean", () => {
  const schema = s.secret(
    s.object({ user: s.string(), pass: text, n: s.number(), on: s.boolean(), tags: s.array(s.array(s.string())) }),
  );
  const value = parsed(schema, { user: "ada", pass: "inner-value", n: 7, on: true, tags: [["t1"], ["t2"]] });
  expect(secretValues(value)).toEqual(["ada", "inner-value", "7", "t1", "t2"]);
  expect(secretValues(parsed(s.secret(s.array(s.string())), ["k1", "", "k2"]))).toEqual(["k1", "k2"]);
});

test("a json secret holding a value that holds itself is read once, keys included", () => {
  const loop: { k: string; self?: unknown } = { k: "inside" };
  loop.self = loop;
  expect(secretValues(Secret.of(loop, json))).toEqual(["k", "inside", "self"]);
});

test("a huge secret is read up to 1,000,000 values and the read ends", () => {
  const many = Array.from({ length: 1_100_000 }, (_, i) => `v${i}`);
  const got = secretValues(Secret.of(many, json));
  expect(got.length).toBe(999_999);
  expect(got[0]).toBe("v0");
});

test("a deeply nested secret does not overflow the stack", () => {
  let deep: unknown = "bottom";
  for (let i = 0; i < 200_000; i++) deep = [deep];
  expect(secretValues(Secret.of(deep, json))).toEqual(["bottom"]);
});

test("a value that holds itself is read once", () => {
  const loop: { k: unknown; self?: unknown; again: unknown[] } = { k: parsed(text, "once"), again: [] };
  loop.self = loop;
  loop.again.push(loop);
  expect(secretValues(loop)).toEqual(["once"]);
});

test("property: every secret string placed at a generated path is returned", () => {
  const step = fc.oneof(fc.stringMatching(/^[a-z]{1,4}$/), fc.integer({ min: 0, max: 3 }));
  const placed = fc.record({ path: fc.array(step, { maxLength: 5 }), secret: fc.string({ minLength: 1 }) });
  fc.assert(
    fc.property(fc.array(placed, { minLength: 1, maxLength: 4 }), (all) => {
      const leaves = all.map(({ path, secret }) => {
        let at: unknown = parsed(text, secret);
        for (const k of [...path].reverse())
          at = typeof k === "string" ? { other: "plain", [k]: at } : [...Array.from({ length: k }, () => "plain"), at];
        return at;
      });
      expect(secretValues({ leaves })).toEqual(all.map((p) => p.secret));
    }),
    { seed: 1337, numRuns: 200 },
  );
});

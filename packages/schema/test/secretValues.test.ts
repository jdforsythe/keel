// Seed 1337. The internal read @keel/server takes of a decoded action input: each Secret under it, revealed, as text.
import fc from "fast-check";
import { expect, test } from "vitest";
import { s } from "../src/index.ts";
import { secretValues } from "../src/internal/index.ts";

const parsed = (schema: { parse(x: unknown): { ok: true; value: unknown } | { ok: false } }, x: unknown): unknown => {
  const r = schema.parse(x);
  if (!r.ok) throw new Error("the fixture does not parse");
  return r.value;
};
const text = s.secret(s.string());

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

test("a secret holding an object gives no string of its own; a secret inside it is read", () => {
  const schema = s.secret(s.object({ user: s.string(), pass: text, tags: s.array(s.string()) }));
  expect(secretValues(parsed(schema, { user: "ada", pass: "inner-value", tags: ["t"] }))).toEqual(["inner-value"]);
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

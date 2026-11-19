import { type JsonValue, s } from "@keel/schema";
import { gen } from "@keel/schema/gen";
// `redact` (std.sessions Redaction): generated values parse, secrets always go, paths and `*`, `x` masks. Seed 1337
import fc from "fast-check";
import { expect, test } from "vitest";
import { redact } from "../src/redact.ts";

const Pay = s.object({
  card: s.object({ number: s.string({ min: 12 }), cvc: s.secret(s.string()) }),
  lines: s.array(s.object({ sku: s.id("Sku"), qty: s.int({ min: 1 }), note: s.string().optional() })),
  kind: s.enum(["visa", "amex"]),
  meta: s.json(),
});

test("a redacted value is replaced, the result parses, and secrets are always replaced", () => {
  fc.assert(
    fc.property(gen(Pay), (value) => {
      const encoded = Pay.encode(value);
      const out = redact(Pay, encoded, { paths: ["card.number", "lines.*.qty"], seed: 1337, salt: "tx:cart.pay" });
      expect(Pay.parse(out).ok).toBe(true);
      const text = JSON.stringify(out);
      expect(text).not.toContain("[secret]");
      if (value.card.number.length >= 12 && /[^a-z]/.test(value.card.number))
        expect(text).not.toContain(JSON.stringify(value.card.number));
    }),
    { seed: 1337, numRuns: 100 },
  );
});

test("redaction is deterministic in seed, salt and path, and leaves other paths alone", () => {
  const v: JsonValue = {
    card: { number: "4242424242424242", cvc: "[secret]" },
    lines: [],
    kind: "visa",
    meta: { a: "b" },
  };
  const a = redact(Pay, v, { paths: ["card.number"], seed: 1, salt: "tx:x" });
  expect(redact(Pay, v, { paths: ["card.number"], seed: 1, salt: "tx:x" })).toEqual(a);
  expect(redact(Pay, v, { paths: ["card.number"], seed: 2, salt: "tx:x" })).not.toEqual(a);
  expect(JSON.stringify(a)).toContain('"kind":"visa"');
  expect(JSON.stringify(a)).toContain('"meta":{"a":"b"}');
});

test("under s.json() a matched value is masked: string x repeated, number 0, boolean false, else null", () => {
  const out = redact(
    s.json(),
    { a: "secret", n: 7, b: true, o: { k: 1 }, l: ["q", "r"] },
    {
      paths: ["a", "n", "b", "o", "l.*"],
      seed: 0,
      salt: "error:x",
    },
  );
  expect(out).toEqual({ a: "xxxxxx", n: 0, b: false, o: null, l: ["x", "x"] });
});

test("strings mode writes every s.string() value as x repeated unless an except path covers it", () => {
  const Card = s.object({ name: s.string(), city: s.string(), kind: s.enum(["a", "b"]), id: s.id("Card") });
  const out = redact(
    Card,
    { name: "Ada", city: "Paris", kind: "a", id: "c1" },
    {
      paths: [],
      seed: 0,
      salt: "store:x",
      strings: { except: ["city"] },
    },
  );
  expect(out).toEqual({ name: "xxx", city: "Paris", kind: "a", id: "c1" });
});

test("a union variant is walked by its tag; a null nullable stays null", () => {
  const U = s.union("t", [
    s.object({ t: s.literal("a"), v: s.secret(s.int()) }),
    s.object({ t: s.literal("b"), w: s.string().nullable() }),
  ]);
  expect(redact(U, { t: "a", v: "[secret]" }, { paths: [], seed: 0, salt: "s" })).toEqual({ t: "a", v: 0 });
  expect(redact(U, { t: "b", w: null }, { paths: ["w"], seed: 0, salt: "s" })).toEqual({ t: "b", w: null });
});

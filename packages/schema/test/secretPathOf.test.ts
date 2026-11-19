// Seed 1337. The internal secret path read by @keel/store: object keys only, first secret in declaration order.
import fc from "fast-check";
import { expect, test } from "vitest";
import { type Schema, s } from "../src/index.ts";
import { secretPathOf } from "../src/internal/index.ts";

test("names object keys to the first secret, null when there is none", () => {
  expect(secretPathOf(s.secret(s.string()).node)).toBe("");
  expect(secretPathOf(s.object({ a: s.int(), b: s.object({ c: s.secret(s.int()) }) }).node)).toBe("b.c");
  expect(secretPathOf(s.object({ x: s.secret(s.int()), y: s.secret(s.int()) }).node)).toBe("x");
  expect(secretPathOf(s.array(s.record(s.object({ k: s.secret(s.int()).nullable() }))).node)).toBe("k");
  expect(secretPathOf(s.union([s.int(), s.object({ m: s.secret(s.int()).optional() })]).node)).toBe("m");
  expect(secretPathOf(s.union("t", [s.object({ t: s.literal("a"), v: s.secret(s.int()) })]).node)).toBe("v");
  expect(secretPathOf(s.object({ a: s.json(), b: s.array(s.enum(["x"])) }).node)).toBeNull();
});

test("a path of nested object keys is returned as written, at every depth", () => {
  fc.assert(
    fc.property(fc.array(fc.stringMatching(/^[a-z]{1,4}$/), { maxLength: 6 }), (keys) => {
      let schema: Schema<unknown> = s.secret(s.string());
      for (const k of [...keys].reverse()) schema = s.object({ [k]: schema });
      expect(secretPathOf(schema.node)).toBe(keys.join("."));
    }),
    { seed: 1337, numRuns: 50 },
  );
});

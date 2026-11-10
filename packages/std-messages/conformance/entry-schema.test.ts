// Spec: std.messages, clause "For a fixture set with keys `title` (no params), `count` (`n: s.int()`) and `kind` (`k: s.enum(['a', 'b'])`), every `gen` entry parses and round-trips; `title: 'a{b'`, a template naming `{x}`, a `plural` on `k` and a `select` without case `b` each fail with rule `format` at the key's path; a missing key fails with `required`, an extra one with `unknown-key`."
// Seed 1337
import { gen } from "@keel/schema/gen";
import fc from "fast-check";
import { expect, test } from "vitest";

const SEED = 1337;
const valid = {
  title: "Recipes",
  count: { plural: "n", one: "# recipe", other: "# recipes" },
  kind: { select: "k", cases: { a: "A", b: "B" } },
};

test.skip("For a fixture set with keys `title` (no params), `count` (`n: s.int()`) and `kind` (`k: s.enum(['a', 'b'])`), every `gen` entry parses and round-trips; `title: 'a{b'`, a template naming `{x}`, a `plural` on `k` and a `select` without case `b` each fail with rule `format` at the key's path; a missing key fails with `required`, an extra one with `unknown-key`.", async () => {
  const { Demo } = await import("./fixtures/Demo.schema.ts");
  const issues = (input: unknown) => {
    const r = Demo.parse(input);
    return r.ok ? [] : r.error.data.issues;
  };
  fc.assert(
    fc.property(gen(Demo), (entry) => {
      const parsed = Demo.parse(entry);
      expect(parsed.ok).toBe(true);
      expect(Demo.parse(Demo.encode(entry))).toEqual({ ok: true, value: entry });
    }),
    { seed: SEED, numRuns: 100 },
  );
  expect(issues(valid)).toEqual([]);
  expect(issues({ ...valid, title: "a{b" })).toEqual([{ path: ["title"], rule: "format" }]);
  expect(issues({ ...valid, count: { text: "{x} items" } })).toEqual([{ path: ["count"], rule: "format" }]);
  expect(issues({ ...valid, kind: { plural: "k", other: "# x" } })).toEqual([{ path: ["kind"], rule: "format" }]);
  expect(issues({ ...valid, kind: { select: "k", cases: { a: "A" } } })).toEqual([{ path: ["kind"], rule: "format" }]);
  const { title: _title, ...missing } = valid;
  expect(issues(missing)).toEqual([{ path: ["title"], rule: "required" }]);
  expect(issues({ ...valid, extra: "x" })).toEqual([{ path: ["extra"], rule: "unknown-key" }]);
});

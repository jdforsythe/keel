// Spec: k.module, clause "A `std` key absent from `deps`, or naming an app module, reports E1158, and listing it in `deps` clears it. A `std` value that fails its package's registered schema reports E1158 naming the issue's path; a value that parses is clean."
// Spec: k.module, Rules, "E1158 `std` key that is not a stdlib package (`@keel/std-*`) in `deps`, a `std` value that is not literal JSON, or one that fails the schema registered under its package name (message names the issue's path and rule)."
// Seed 1337
import { check } from "@keel/check";
import { s } from "@keel/schema";
import fc from "fast-check";
import { expect, test } from "vitest";
import { type Files, SEED, lowerId } from "./module-support.ts";

const NO_TYPES = { types: false } as const;

/** A manifest with a `std` key. `std` is the literal source text of the object. */
const withStd = (id: string, deps: string[], std: string): Files[number] => ({
  path: `modules/${id}/module.ts`,
  source: `import { module } from '@keel/compiler'
export default module({
  id: '${id}',
  deps: [${deps.map((d) => `'${d}'`).join(", ")}],
  capabilities: [],
  public: { exports: [] },
  std: ${std},
})
`,
});

const e1158 = (files: Files) => check(files, NO_TYPES).diagnostics.filter((d) => d.code === "E1158");

// Unique package names: the schema registry is process-global.
s.register("@keel/std-cfgone", s.object({ limit: s.int({ min: 1 }), label: s.string() }));
s.register("@keel/std-cfgtwo", s.object({ mode: s.enum(["a", "b"]) }));

test("a `std` key absent from `deps` reports E1158, and listing it in `deps` clears it", () => {
  fc.assert(
    fc.property(lowerId, fc.integer({ min: 1, max: 99 }), (id, limit) => {
      const std = `{ '@keel/std-cfgone': { limit: ${limit}, label: 'x' } }`;
      expect(e1158([withStd(id, [], std)]).length).toBe(1);
      expect(e1158([withStd(id, ["@keel/std-cfgone"], std)])).toEqual([]);
    }),
    { seed: SEED, numRuns: 40 },
  );
});

test("a `std` key naming an app module reports E1158 even when the module is in `deps`", () => {
  fc.assert(
    fc.property(lowerId, (id) => {
      fc.pre(id !== "other");
      const files: Files = [
        withStd(id, ["other"], "{ 'other': { limit: 1 } }"),
        {
          path: "modules/other/module.ts",
          source:
            "import { module } from '@keel/compiler'\nexport default module({ id: 'other', deps: [], capabilities: [], public: { exports: [] } })\n",
        },
      ];
      expect(e1158(files).length).toBe(1);
    }),
    { seed: SEED, numRuns: 30 },
  );
});

test("a `std` value that is not literal JSON reports E1158", () => {
  const bad = [
    "{ '@keel/std-cfgone': computed() }",
    "{ '@keel/std-cfgone': { limit: 1 + 1, label: 'x' } }",
    "{ '@keel/std-cfgone': { limit: 1, label: `a${'b'}` } }",
    "{ '@keel/std-cfgone': { limit: 1, label: name } }",
  ];
  for (const std of bad) {
    expect(e1158([withStd("a", ["@keel/std-cfgone"], std)]).length).toBe(1);
  }
});

test("a `std` value that fails its package's registered schema reports E1158 naming the issue's path", () => {
  fc.assert(
    fc.property(fc.integer({ min: -50, max: 0 }), (limit) => {
      const std = `{ '@keel/std-cfgone': { limit: ${limit}, label: 'x' } }`;
      const d = e1158([withStd("a", ["@keel/std-cfgone"], std)]);
      expect(d.length).toBe(1);
      expect(d[0]?.message).toContain("limit");
      expect(d[0]?.message).not.toContain("label");
    }),
    { seed: SEED, numRuns: 40 },
  );
  const wrongKey = e1158([withStd("a", ["@keel/std-cfgtwo"], "{ '@keel/std-cfgtwo': { mode: 'c' } }")]);
  expect(wrongKey.length).toBe(1);
  expect(wrongKey[0]?.message).toContain("mode");
  const missing = e1158([withStd("a", ["@keel/std-cfgone"], "{ '@keel/std-cfgone': { limit: 1 } }")]);
  expect(missing.length).toBe(1);
  expect(missing[0]?.message).toContain("label");
});

test("a `std` value that parses with its registered schema is clean", () => {
  fc.assert(
    fc.property(fc.integer({ min: 1, max: 1000 }), fc.stringMatching(/^[a-z]{1,8}$/), (limit, label) => {
      const std = `{ '@keel/std-cfgone': { limit: ${limit}, label: '${label}' } }`;
      expect(check([withStd("a", ["@keel/std-cfgone"], std)], NO_TYPES).diagnostics.map((d) => d.code)).toEqual([]);
    }),
    { seed: SEED, numRuns: 40 },
  );
});

test("a `std` key whose package registers no schema and is in `deps` is clean when the value is literal JSON", () => {
  const files = [withStd("a", ["@keel/std-noschema"], "{ '@keel/std-noschema': { any: [1, 'two', null, true] } }")];
  expect(e1158(files)).toEqual([]);
});

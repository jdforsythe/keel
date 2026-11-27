// Spec: k.schema, clause "`isSchema(s.string())` and `isSchema(s.object({ a: s.int() }))` are true; `isSchema({ parse: () => ok(1) })` and `isSchema(null)` are false."
// k.schema, Guard "`isSchema(x)` (`@keel/schema`) is true only of a schema `s` built, and `isObjectSchema(x)` of one `s.object` built, by the kernel's own record (k.identity)."
// Seed 1337.
import { isSchema, ok, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { RUNS, SEED, allTypes } from "./fixtures";

const opts = { seed: SEED, numRuns: RUNS };

describe("k.schema: isSchema", () => {
  it("`isSchema(s.string())` and `isSchema(s.object({ a: s.int() }))` are true", () => {
    expect(isSchema(s.string())).toBe(true);
    expect(isSchema(s.object({ a: s.int() }))).toBe(true);
  });

  it("`isSchema({ parse: () => ok(1) })` and `isSchema(null)` are false", () => {
    expect(isSchema({ parse: () => ok(1) })).toBe(false);
    expect(isSchema(null)).toBe(false);
  });

  it("every schema the module builds is a schema, derived ones too", () => {
    for (const schema of Object.values(allTypes)) expect(isSchema(schema)).toBe(true);
    expect(isSchema(s.string().optional())).toBe(true);
    expect(isSchema(s.array(s.int()).nullable())).toBe(true);
    expect(isSchema(s.record(s.string()))).toBe(true);
  });

  it("property: no value of any other kind is a schema", () => {
    fc.assert(
      fc.property(fc.anything(), (x) => {
        expect(isSchema(x)).toBe(false);
      }),
      opts,
    );
  });
});

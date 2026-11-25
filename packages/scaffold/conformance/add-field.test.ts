// k.scaffold, Codemods "`add-field` adds a field to a schema and to every initial state, fixture, and form `initial` that constructs it."
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { RUNS, SEED, apply, lowerName, read, withSchema, word } from "./fixtures.ts";

const SCHEMA = "modules/orders/Order.schema.ts";
const CONSUMERS = ["modules/orders/OrderForm.tsx", "modules/orders/Order.fixture.ts"];

// seed 1337
describe("add-field", () => {
  it("add-field of an optional field adds it to the schema and needs no data", () => {
    fc.assert(
      fc.property(lowerName, (field) => {
        const before = withSchema(true);
        const out = apply("add-field", { schema: "Order", field, type: "string.optional" }, before).files;
        expect(word(field).test(read(out, SCHEMA))).toBe(true);
        for (const p of CONSUMERS) expect(read(out, p), p).toBe(read(before, p));
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });

  it("add-field of a required field with a default adds it to the schema and every initial, fixture, and form that constructs it", () => {
    fc.assert(
      fc.property(lowerName, fc.integer({ min: 0, max: 999 }), (field, def) => {
        const out = apply("add-field", { schema: "Order", field, type: "int", default: def }, withSchema(true)).files;
        expect(word(field).test(read(out, SCHEMA))).toBe(true);
        for (const p of CONSUMERS) expect(read(out, p), p).toMatch(new RegExp(`\\b${field}\\s*:\\s*${def}\\b`));
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });
});

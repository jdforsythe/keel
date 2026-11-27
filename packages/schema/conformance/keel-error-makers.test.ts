// Spec: k.expect, clause "`keelError.denied.make({})` deep-equals `{ code: 'keel.denied', message: 'keel.denied', data: {} }`; `notFound`, `conflict`, `unreachable` and `busy` give their codes the same way; `keelError.fields.make({ 'address.city': 'Taken' })` has code `keel.fields` and that data; a guard returning `err(keelError.denied.make({}))` on a node server answers 403, and an action returning that `fields` error answers 422."
// Seed 1337. The guard-and-action half (403 and 422 on a node server) is packages/server/conformance/keel-error-status.test.ts.
// Not yet exported: `keelError` is `@keel/schema`'s once built, so this file does not typecheck and fails for want of it until then.
import { keelError } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { RUNS, SEED } from "./fixtures";

describe("k.expect Made errors: keelError", () => {
  it("`keelError.denied.make({})` deep-equals { code: 'keel.denied', message: 'keel.denied', data: {} }", () => {
    expect(keelError.denied.make({})).toEqual({ code: "keel.denied", message: "keel.denied", data: {} });
  });

  for (const name of ["notFound", "conflict", "unreachable", "busy"] as const) {
    it(`\`keelError.${name}.make({})\` gives code keel.${name}, the code as its message and data {}`, () => {
      expect(keelError[name].make({})).toEqual({ code: `keel.${name}`, message: `keel.${name}`, data: {} });
    });
  }

  it("`keelError.fields.make({ 'address.city': 'Taken' })` has code `keel.fields` and that data", () => {
    const e = keelError.fields.make({ "address.city": "Taken" });
    expect(e.code).toBe("keel.fields");
    expect(e.data).toEqual({ "address.city": "Taken" });
  });

  it("property: `keelError.fields.make(m)` carries any map of field paths to messages as its data and round-trips JSON", () => {
    fc.assert(
      fc.property(fc.dictionary(fc.stringMatching(/^[a-z]{1,6}(\.[a-z]{1,6}){0,2}$/), fc.string()), (m) => {
        const e = keelError.fields.make(m);
        expect(e.data).toEqual(m);
        expect(JSON.parse(JSON.stringify(e))).toEqual(e);
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });
});

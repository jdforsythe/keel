// Properties for ok/err. fast-check seed 1337 (fixed for determinism).
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { err, ok } from "../src/index.ts";

fc.configureGlobal({ seed: 1337, numRuns: 100 });

describe("ok / err", () => {
  it("ok wraps any value by reference with ok: true", () => {
    fc.assert(
      fc.property(fc.anything(), (v) => {
        const r = ok(v);
        expect(r.ok).toBe(true);
        if (r.ok) expect(r.value).toBe(v);
      }),
    );
  });
  it("err wraps any error by reference with ok: false", () => {
    fc.assert(
      fc.property(fc.anything(), (e) => {
        const r = err(e);
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.error).toBe(e);
      }),
    );
  });
});

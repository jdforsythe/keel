// Spec: k.scaffold, Rules "E1354 `add-field` of a required field without `--default` while constructors exist."
import fc from "fast-check";
import { expect, it } from "vitest";
import { RUNS, SEED, errText, lowerName, scaffoldRaw, snap, withSchema } from "./fixtures.ts";

// seed 1337
it("add-field of a required field without a default while constructors exist reports E1354 and writes nothing", () => {
  fc.assert(
    fc.property(lowerName, (field) => {
      const f = withSchema(true);
      const before = snap(f);
      const r = scaffoldRaw("add-field", { schema: "Order", field, type: "int" }, f);
      expect(r.ok).toBe(false);
      expect(errText(r)).toContain("E1354");
      expect(snap(f)).toBe(before);
    }),
    { seed: SEED, numRuns: RUNS },
  );
});

it("clean counterparts: a default, an optional type, or no constructors do not report E1354", () => {
  fc.assert(
    fc.property(lowerName, (field) => {
      expect(scaffoldRaw("add-field", { schema: "Order", field, type: "int", default: 0 }, withSchema(true)).ok).toBe(
        true,
      );
      expect(scaffoldRaw("add-field", { schema: "Order", field, type: "int.optional" }, withSchema(true)).ok).toBe(
        true,
      );
      expect(scaffoldRaw("add-field", { schema: "Order", field, type: "int" }, withSchema(false)).ok).toBe(true);
    }),
    { seed: SEED, numRuns: RUNS },
  );
});

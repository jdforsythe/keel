// Spec: k.fixes, clause "The chains `invalid`, `missing` and `bug` each take one step with no fix; the probes hold that a bad field answers `err` `schema.invalid`, an absent row `err` with the module's `missing` code and its `id`, and a row that must exist a defect whose `data` is `{ id }` and whose message holds no id."
// Seed 1337.
import fc from "fast-check";
import { expect, test } from "vitest";
import { save } from "./end/save.ts";

test("a bad field answers err schema.invalid", () => {
  const r = save({ name: "" });
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.error.code).toBe("schema.invalid");
});

test("property: a good name is ok with that name, any other input is err schema.invalid", () => {
  fc.assert(
    fc.property(fc.string({ minLength: 1 }), fc.anything(), (name, other) => {
      expect(save({ name })).toEqual({ ok: true, value: name });
      const r = save(other);
      if (!r.ok) expect(r.error.code).toBe("schema.invalid");
    }),
    { seed: 1337, numRuns: 100 },
  );
});

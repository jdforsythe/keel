// Spec: k.fixes, clause "The chains `invalid`, `missing` and `bug` each take one step with no fix; the probes hold that a bad field answers `err` `schema.invalid`, an absent row `err` with the module's `missing` code and its `id`, and a row that must exist a defect whose `data` is `{ id }` and whose message holds no id."
// Seed 1337.
import fc from "fast-check";
import { expect, test } from "vitest";
import { load } from "./end/load.ts";

test("an absent row answers err shop.missing with its id", () => {
  const r = load([], "7");
  expect(r.ok).toBe(false);
  if (r.ok) return;
  expect(r.error.code).toBe("shop.missing");
  expect(r.error.data).toEqual({ id: "7" });
});

test("property: a present row is ok, an absent one is err with that id", () => {
  fc.assert(
    fc.property(fc.string(), fc.string(), (id, other) => {
      fc.pre(id !== other);
      expect(load([{ id, name: "n" }], id)).toEqual({ ok: true, value: { id, name: "n" } });
      const r = load([{ id: other, name: "n" }], id);
      expect(!r.ok && r.error.data).toEqual({ id });
    }),
    { seed: 1337, numRuns: 100 },
  );
});

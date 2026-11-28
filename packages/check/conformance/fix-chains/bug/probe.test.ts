// Spec: k.fixes, clause "The chains `invalid`, `missing` and `bug` each take one step with no fix; the probes hold that a bad field answers `err` `schema.invalid`, an absent row `err` with the module's `missing` code and its `id`, and a row that must exist a defect whose `data` is `{ id }` and whose message holds no id."
// Seed 1337.
import { isDefect } from "@keel/schema";
import fc from "fast-check";
import { expect, test } from "vitest";
import { name } from "./end/name.ts";

const caught = (fn: () => unknown): unknown => {
  try {
    fn();
  } catch (e) {
    return e;
  }
  return undefined;
};

test("a row that must exist and does not is a defect whose data is { id } and whose message holds no id", () => {
  const v = caught(() => name(new Map(), "row-42"));
  expect(isDefect(v)).toBe(true);
  expect(v instanceof Error && v.message).toBe("no row");
  expect(Object.getOwnPropertyDescriptor(v, "data")?.value).toEqual({ id: "row-42" });
});

test("property: the message never holds the id", () => {
  fc.assert(
    fc.property(fc.string({ minLength: 3 }), (id) => {
      fc.pre(!"no row".includes(id));
      const v = caught(() => name(new Map(), id));
      expect(v instanceof Error && v.message.includes(id)).toBe(false);
      expect(Object.getOwnPropertyDescriptor(v, "data")?.value).toEqual({ id });
    }),
    { seed: 1337, numRuns: 100 },
  );
});

// @vitest-environment happy-dom
// Spec: k.testing Conformance "... on the focused element it runs no focus or blur handler."
// Seed: 1337 (fc.assert below).
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { FOCUSABLE, SEED, focusEvents, focusedIds, log, mount } from "./key-support.ts";

describe("k.testing: a key on the focused element fires no focus event", () => {
  it("fire(id, keydown) on the element that has focus runs its keydown handler and no focus or blur handler", async () => {
    const t = mount();
    await t.fire("a", { type: "focus" });
    log.length = 0;
    await t.fire("a", { type: "keydown", key: "a" });
    expect(log).toEqual(["keydown:a@a"]);
    expect(focusedIds(t)).toEqual(["a"]);
    t.dispose();
  });

  it("repeated keys on the focused element fire no focus or blur event (property)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...FOCUSABLE),
        fc.array(fc.string({ minLength: 1, maxLength: 4 }), { minLength: 1, maxLength: 5 }),
        async (id, keys) => {
          const t = mount();
          await t.fire(id, { type: "focus" });
          log.length = 0;
          for (const key of keys) await t.fire(id, { type: "keydown", key });
          expect(focusEvents()).toEqual([]);
          expect(log).toHaveLength(keys.length);
          t.dispose();
        },
      ),
      { seed: SEED, numRuns: 20 },
    );
  });
});

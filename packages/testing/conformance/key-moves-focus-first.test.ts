// @vitest-environment happy-dom
// Spec: k.testing Harness "With focus elsewhere and `id` focusable as `focus` requires, `fire` first moves focus to `id` as `focus` does and settles, then dispatches at `id`."
// Spec: k.testing Conformance "With focus on another input, `fire(id, keydown)` on a focusable element runs the other input's blur handler, then `id`'s focus handler, then its keydown handler, and `find(id).state.focused` is then true; ..."
// Seed: 1337 (fc.assert below).
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { FOCUSABLE, SEED, focusedIds, log, mount } from "./key-support.ts";

describe("k.testing: a key at an unfocused focusable target moves focus first", () => {
  it("with focus on another input, fire(id, keydown) runs the other input's blur handler once, then id's focus handler, then its keydown handler, and find(id).state.focused is true", async () => {
    const t = mount();
    await t.fire("a", { type: "focus" });
    log.length = 0;
    await t.fire("b", { type: "keydown", key: "a" });
    expect(log).toEqual(["blur:a", "focus:b", "keydown:b@b"]);
    expect(t.find("b").state.focused).toBe(true);
    expect(focusedIds(t)).toEqual(["b"]);
    t.dispose();
  });

  it("with focus nowhere, the key's target gets its focus handler, then its keydown handler, and focus", async () => {
    const t = mount();
    await t.fire("a", { type: "keydown", key: "a" });
    expect(log).toEqual(["focus:a", "keydown:a@a"]);
    expect(t.find("a").state.focused).toBe(true);
    t.dispose();
  });

  it("for any ordered pair of distinct focusable elements the order is blur, focus, keydown (property)", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...FOCUSABLE), fc.constantFrom(...FOCUSABLE), async (from, to) => {
        fc.pre(from !== to);
        const t = mount();
        await t.fire(from, { type: "focus" });
        log.length = 0;
        await t.fire(to, { type: "keydown", key: "x" });
        expect(log).toEqual([`blur:${from}`, `focus:${to}`, `keydown:${to}@${to}`]);
        expect(focusedIds(t)).toEqual([to]);
        t.dispose();
      }),
      { seed: SEED, numRuns: 20 },
    );
  });
});

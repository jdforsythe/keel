// @vitest-environment happy-dom
// k.testing Harness "`keydown` goes to the document's focused element, as a key press does. With focus on `id` or inside it, it is dispatched there and bubbles through `id`, and no focus event fires."
// Spec: k.testing, clause "With focus on an `input` inside an unfocusable container, `fire(container, { type: 'keydown', key: 'Enter' })` calls the input's and the container's keydown handlers once each, `event.target` the input, and no focus or blur handler."
// Seed: 1337 (fc.assert below).
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, focusEvents, focusedIds, keydowns, log, mount } from "./key-support.ts";

describe("k.testing: a key goes to the focused descendant", () => {
  it("with focus on an input inside an unfocusable container, fire(container, keydown Enter) calls the input's and the container's keydown handlers once each, event.target the input, and no focus or blur handler", async () => {
    const t = mount();
    await t.fire("in", { type: "focus" });
    log.length = 0;
    await t.fire("box", { type: "keydown", key: "Enter" });
    expect([...keydowns()].sort()).toEqual(["keydown:box@in", "keydown:in@in"]);
    expect(focusEvents()).toEqual([]);
    expect(focusedIds(t)).toEqual(["in"]);
    t.dispose();
  });

  it("for any key the container's press reaches the focused input and no focus event fires (property)", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 1, maxLength: 8 }), async (key) => {
        const t = mount();
        await t.fire("in", { type: "focus" });
        log.length = 0;
        await t.fire("box", { type: "keydown", key });
        expect(keydowns()).toHaveLength(2);
        expect(keydowns().every((l) => l.endsWith("@in"))).toBe(true);
        expect(focusEvents()).toEqual([]);
        t.dispose();
      }),
      { seed: SEED, numRuns: 20 },
    );
  });
});

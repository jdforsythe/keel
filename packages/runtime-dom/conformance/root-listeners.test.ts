// @vitest-environment happy-dom
// Spec: k.runtime Conformance 2. Property seed: 1337.
import * as fc from "fast-check";
import { mount } from "@keel/runtime-dom";
import { clone, on, template } from "@keel/runtime-dom/ops";
import { describe, expect, it } from "vitest";
import { SEED, trackListeners } from "./fixtures.ts";

const BUBBLING = ["click", "input", "keydown", "keyup", "pointerdown", "pointerup", "change", "submit", "mousedown"];

describe("k.runtime: a tree using N distinct bubbling event types attaches exactly N listeners to its root", () => {
  it("a tree using N distinct bubbling event types attaches exactly N listeners to its root", () => {
    fc.assert(
      fc.property(fc.subarray(BUBBLING, { minLength: 1 }), fc.integer({ min: 1, max: 3 }), (types, copies) => {
        const tr = trackListeners();
        try {
          const el = document.createElement("div");
          const html = `<div id="r">${types.flatMap((_, i) => Array.from({ length: copies }, (_, c) => `<button id="b${i}_${c}"></button>`)).join("")}</div>`;
          const T = template(html);
          const dispose = mount(() => {
            const r = clone(T);
            types.forEach((t, i) => {
              for (let c = 0; c < copies; c++) on(`b${i}_${c}`, t, () => {});
            });
            return r;
          }, el);
          expect(tr.liveOn(el)).toBe(types.length);
          dispose();
        } finally {
          tr.stop();
        }
      }),
      { seed: SEED, numRuns: 25 },
    );
  });
});

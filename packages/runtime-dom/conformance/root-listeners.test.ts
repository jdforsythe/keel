import { createCtx } from "@keel/ctx";
import { mount } from "@keel/runtime-dom";
import { clone, on, template } from "@keel/runtime-dom/ops";
// @vitest-environment happy-dom
// Spec: k.runtime, clause "A tree using N bubbling event types has exactly N bubble listeners on its root."
// Property seed: 1337.
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, trackListeners } from "./fixtures.ts";

const simCtx = createCtx({ mode: "sim", seed: 1337 });

const BUBBLING = ["click", "input", "keydown", "keyup", "pointerdown", "pointerup", "change", "submit", "mousedown"];

describe("k.runtime: a tree using N bubbling event types has exactly N bubble listeners on its root", () => {
  it("a tree using N bubbling event types has exactly N bubble listeners on its root", () => {
    fc.assert(
      fc.property(fc.subarray(BUBBLING, { minLength: 1 }), fc.integer({ min: 1, max: 3 }), (types, copies) => {
        const tr = trackListeners();
        try {
          const el = document.createElement("div");
          const html = `<div id="r">${types.flatMap((_, i) => Array.from({ length: copies }, (_, c) => `<button id="b${i}_${c}"></button>`)).join("")}</div>`;
          const T = template(html);
          const dispose = mount(
            () => {
              const r = clone(T);
              types.forEach((t, i) => {
                for (let c = 0; c < copies; c++) on(`b${i}_${c}`, t, () => {});
              });
              return r;
            },
            el,
            { ctx: simCtx },
          );
          expect(tr.liveBubbleOn(el)).toBe(types.length);
          dispose();
        } finally {
          tr.stop();
        }
      }),
      { seed: SEED, numRuns: 25 },
    );
  });
});

import { signal } from "@keel/reactive";
import { mount } from "@keel/runtime-dom";
import { clone, on, template, text } from "@keel/runtime-dom/ops";
// @vitest-environment happy-dom
// Spec: k.runtime Conformance 1. Property seed: 1337.
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, click, flush, inScope, trackListeners } from "./fixtures.ts";

const T = template('<div id="root"><button id="b">x</button></div>');

describe("k.runtime: mount then dispose leaves zero event listeners and zero reactive subscriptions", () => {
  it("mount then dispose leaves zero event listeners", () => {
    fc.assert(
      fc.property(fc.subarray(["click", "input", "keydown", "pointerdown"], { minLength: 1 }), (types) => {
        const tr = trackListeners();
        try {
          const el = document.createElement("div");
          const base = tr.live();
          const dispose = mount(() => {
            const r = clone(T);
            for (const t of types) on("b", t, () => {});
            return r;
          }, el);
          expect(tr.live()).toBeGreaterThan(base);
          dispose();
          expect(tr.live()).toBe(base);
        } finally {
          tr.stop();
        }
      }),
      { seed: SEED, numRuns: 25 },
    );
  });

  it("mount then dispose leaves zero reactive subscriptions: a signal written after dispose runs nothing", async () => {
    let runs = 0;
    const el = document.createElement("div");
    const {
      value: { s, dispose },
      dispose: endScope,
    } = inScope(() => {
      const s = signal(0);
      const dispose = mount(() => {
        const r = clone(T);
        text(r, () => {
          runs++;
          return String(s.get());
        });
        return r;
      }, el);
      return { s, dispose };
    });
    const before = runs;
    s.set(1);
    await flush();
    expect(runs).toBeGreaterThan(before);
    dispose();
    const after = runs;
    s.set(2);
    s.set(3);
    await flush();
    expect(runs).toBe(after);
    endScope();
  });

  it("after dispose, a click dispatched on the old tree runs no handler", () => {
    const el = document.createElement("div");
    let hits = 0;
    const dispose = mount(() => {
      const r = clone(T);
      on("b", "click", () => hits++);
      return r;
    }, el);
    const b = el.querySelector("#b");
    if (b === null) throw new Error("no #b");
    click(b);
    expect(hits).toBe(1);
    dispose();
    click(b);
    expect(hits).toBe(1);
  });
});

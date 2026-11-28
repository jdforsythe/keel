// @vitest-environment happy-dom
// Spec: k.shared, clause "Under `mount` in a browser, a click handler's `last.set('x')` on that module signal changes it and raises nothing."
// Seed 1337. The module signal is made in `moduleRoot` from `@keel/reactive/internal` (a test file is not compiled; the compiler wraps a top-level call the same way).
// No request is being served here: a browser's module state is one person's (k.shared Reactive state), so the handler's write, and a node it makes in a module root, are not judged.
import { createCtx } from "@keel/ctx";
import { owner, signal } from "@keel/reactive";
import { moduleRoot } from "@keel/reactive/internal";
import { mount } from "@keel/runtime-dom";
import { clone, on, template } from "@keel/runtime-dom/ops";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, click } from "./fixtures.ts";

const simCtx = createCtx({ mode: "sim", seed: 1337 });
const last = moduleRoot(() => signal(""));
const T = template('<div><button id="b">x</button></div>');

const clickOnce = (handler: () => void): void => {
  const el = document.createElement("div");
  const dispose = mount(
    () => {
      const r = clone(T);
      on("b", "click", handler);
      return r;
    },
    el,
    { ctx: simCtx },
  );
  const target = el.querySelector("#b");
  if (target === null) throw new Error("no button");
  click(target);
  dispose();
};

describe("k.shared on a page", () => {
  it("a click handler's last.set('x') on a module signal changes it and raises nothing", () => {
    last.set("");
    const raised: unknown[] = [];
    clickOnce(() => {
      try {
        last.set("x");
      } catch (e) {
        raised.push(e);
      }
    });
    expect(raised).toEqual([]);
    expect(last.get()).toBe("x");
  });

  it("property: a click handler writing any value to the module signal changes it and raises nothing", () => {
    fc.assert(
      fc.property(fc.string(), (v) => {
        last.set("\u0000start");
        const raised: unknown[] = [];
        clickOnce(() => {
          try {
            last.set(v);
          } catch (e) {
            raised.push(e);
          }
        });
        expect(raised).toEqual([]);
        expect(last.get()).toBe(v);
      }),
      { seed: SEED, numRuns: 25 },
    );
  });

  it("a click handler making a node in a module root raises nothing on a page", () => {
    const raised: unknown[] = [];
    let made: unknown;
    clickOnce(() => {
      try {
        made = moduleRoot(() => signal(0));
        moduleRoot(() => owner());
      } catch (e) {
        raised.push(e);
      }
    });
    expect(raised).toEqual([]);
    expect(made).toBeDefined();
  });
});

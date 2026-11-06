import { signal } from "@keel/reactive";
import { mount } from "@keel/runtime-dom";
import { attr, clone, template } from "@keel/runtime-dom/ops";
// @vitest-environment happy-dom
// Spec: k.runtime Conformance 7 and Ops (null/false remove, true sets empty). Property seed: 1337.
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, flush, inScope } from "./fixtures.ts";

const T = template('<p id="p"></p>');
type V = string | boolean | null;

const setup = (initial: V) => {
  const {
    value: { s, el, dispose: unmount },
    dispose: endScope,
  } = inScope(() => {
    const s = signal<V>(initial);
    const el = document.createElement("div");
    const unmount = mount(() => {
      const r = clone(T);
      attr(r, "x", () => s.get());
      return r;
    }, el);
    return { s, el, dispose: unmount };
  });
  const p = el.querySelector("#p");
  if (p === null) throw new Error("no #p");
  return {
    s,
    p,
    dispose: () => {
      unmount();
      endScope();
    },
  };
};

describe("k.runtime: attr(el, 'x', fn) removes x when fn returns false and restores it when fn returns a string again", () => {
  it("attr removes x when fn returns false and restores it when fn returns a string again", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 1 }), fc.string({ minLength: 1 }), async (a, b) => {
        const { s, p, dispose } = setup(a);
        expect(p.getAttribute("x")).toBe(a);
        s.set(false);
        await flush();
        expect(p.hasAttribute("x")).toBe(false);
        s.set(b);
        await flush();
        expect(p.getAttribute("x")).toBe(b);
        dispose();
      }),
      { seed: SEED, numRuns: 25 },
    );
  });

  it("attr removes x when fn returns null and sets it empty when fn returns true", async () => {
    const { s, p, dispose } = setup("v");
    s.set(null);
    await flush();
    expect(p.hasAttribute("x")).toBe(false);
    s.set(true);
    await flush();
    expect(p.getAttribute("x")).toBe("");
    dispose();
  });

  it("attr tracks any sequence of values: present iff the last value is a string or true", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.oneof(fc.string({ minLength: 1 }), fc.boolean(), fc.constant(null)), {
          minLength: 1,
          maxLength: 8,
        }),
        async (seq) => {
          const { s, p, dispose } = setup(false);
          for (const v of seq) {
            s.set(v);
            await flush();
          }
          const last = seq[seq.length - 1];
          if (last === false || last === null || last === undefined) expect(p.hasAttribute("x")).toBe(false);
          else expect(p.getAttribute("x")).toBe(last === true ? "" : last);
          dispose();
        },
      ),
      { seed: SEED, numRuns: 25 },
    );
  });
});

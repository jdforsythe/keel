// @vitest-environment happy-dom
// Property seed: 1337. k.runtime Ops: attr null/false remove, true sets empty; text writes one node.
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { mount } from "../src/index.ts";
import { attr, clone, template, text } from "../src/ops/index.ts";
import { SEED, rootSignal } from "./support.ts";

type V = string | number | boolean | null | undefined;
const value = fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null), fc.constant(undefined));
const expected = (v: V): string | null =>
  v === null || v === undefined || v === false ? null : v === true ? "" : String(v);

describe("attr toggling over random value sequences", () => {
  it("after every write the attribute matches the model, and equal writes never touch the DOM", () => {
    const T = template('<p id="p"><b>t</b></p>');
    fc.assert(
      fc.property(value, fc.array(value, { maxLength: 12 }), (initial, seq) => {
        const s = rootSignal<V>(initial);
        const host = document.createElement("div");
        const dispose = mount(() => {
          const p = clone(T);
          attr(p, "data-x", () => s.get());
          return p;
        }, host);
        const p = host.querySelector("#p");
        if (p === null) throw new Error("no #p");
        expect(p.getAttribute("data-x")).toBe(expected(initial));
        let writes = 0;
        const set = p.setAttribute.bind(p);
        p.setAttribute = (n: string, v: string) => {
          writes++;
          set(n, v);
        };
        let prev = expected(initial);
        for (const v of seq) {
          s.set(v);
          const now = expected(v);
          expect(p.getAttribute("data-x")).toBe(now);
          if (now === prev) expect(writes).toBe(0);
          writes = 0;
          prev = now;
        }
        dispose();
      }),
      { seed: SEED, numRuns: 100 },
    );
  });

  it("text binding keeps the element's text node identity and only writes on change", () => {
    const T = template('<span id="s">0</span>');
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 3 }), { maxLength: 10 }), (seq) => {
        const s = rootSignal(0);
        const host = document.createElement("div");
        const dispose = mount(() => {
          const el = clone(T);
          text(el, () => s.get());
          return el;
        }, host);
        const span = host.querySelector("#s");
        const node = span?.firstChild;
        for (const v of seq) {
          s.set(v);
          expect(span?.textContent).toBe(String(v));
          expect(span?.firstChild).toBe(node);
        }
        dispose();
      }),
      { seed: SEED, numRuns: 50 },
    );
  });
});

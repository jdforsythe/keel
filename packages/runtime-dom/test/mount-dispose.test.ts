import { effect } from "@keel/reactive";
// @vitest-environment happy-dom
// Property seed: 1337. k.runtime Conformance 1 over random trees: mount then dispose leaves no listeners.
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { mount } from "../src/index.ts";
import { clone, cond, on, template, text } from "../src/ops/index.ts";
import { SEED, rootSignal, trackListeners } from "./support.ts";

const TYPES = ["click", "input", "keydown", "focus", "blur", "mouseenter", "scroll"];

// parents[i] < i: element i nests under element parents[i] (or the root div when -1).
const html = (parents: readonly number[]): string => {
  const kids = (p: number): string =>
    parents.map((q, i) => (q === p ? `<span id="e${i}">${kids(i)}</span>` : "")).join("");
  return `<div id="root">${kids(-1)}<b id="slot"></b></div>`;
};

const tree = fc.integer({ min: 1, max: 8 }).chain((n) =>
  fc.record({
    parents: fc.tuple(...Array.from({ length: n }, (_, i) => fc.integer({ min: -1, max: i - 1 }))),
    events: fc.array(fc.subarray(TYPES), { minLength: n, maxLength: n }),
    branch: fc.subarray(TYPES, { minLength: 1 }),
    toggles: fc.array(fc.boolean(), { maxLength: 6 }),
  }),
);

describe("mount/dispose leaves no listeners over random trees", () => {
  it("bubbling and direct listeners, including ones in toggled branches, are all removed by dispose", () => {
    const BRANCH = template('<p id="br">x</p>');
    fc.assert(
      fc.property(tree, ({ parents, events, branch, toggles }) => {
        const tr = trackListeners();
        try {
          const show = rootSignal(true);
          const T = template(html(parents));
          const host = document.createElement("div");
          const base = tr.live();
          const dispose = mount(() => {
            const r = clone(T);
            events.forEach((types, i) => {
              for (const t of types) on(`e${i}`, t, () => {});
            });
            const slot = r.querySelector("#slot");
            if (slot === null) throw new Error("no slot");
            cond(
              slot,
              () => show.get(),
              () => {
                const p = clone(BRANCH);
                for (const t of branch) on("br", t, () => {});
                return p;
              },
            );
            return r;
          }, host);
          expect(tr.live()).toBeGreaterThan(base);
          for (const v of toggles) show.set(v);
          dispose();
          expect(tr.live()).toBe(base);
          expect(host.childNodes.length).toBe(0);
        } finally {
          tr.stop();
        }
      }),
      { seed: SEED, numRuns: 100 },
    );
  });

  it("after dispose no binding or effect of the tree runs again", () => {
    const T = template('<div id="d"><b id="slot"></b></div>');
    const P = template('<p id="p">x</p>');
    fc.assert(
      fc.property(fc.array(fc.integer(), { minLength: 1, maxLength: 6 }), (writes) => {
        const s = rootSignal(0);
        let runs = 0;
        const host = document.createElement("div");
        const dispose = mount(() => {
          const r = clone(T);
          const slot = r.querySelector("#slot");
          if (slot === null) throw new Error("no slot");
          text(slot, () => {
            runs++;
            return s.get();
          });
          cond(
            slot,
            () => s.get() >= 0,
            () => {
              const p = clone(P);
              effect(() => {
                s.get();
                runs++;
              });
              return p;
            },
          );
          return r;
        }, host);
        dispose();
        const after = runs;
        let last = 0;
        for (const w of writes) {
          last = w === last ? w + 1 : w;
          s.set(last);
        }
        expect(runs).toBe(after);
      }),
      { seed: SEED, numRuns: 50 },
    );
  });
});

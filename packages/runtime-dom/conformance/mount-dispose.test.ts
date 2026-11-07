import { computed, effect, inspect, signal } from "@keel/reactive";
import type { Computed, Signal } from "@keel/reactive";
import { mount } from "@keel/runtime-dom";
import { attr, clone, on, prop, template, text } from "@keel/runtime-dom/ops";
// @vitest-environment happy-dom
// Spec: k.runtime, clause "`mount` then `dispose` leaves zero event listeners and zero reactive subscriptions."
// Property seed: 1337.
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

  // inspect() returns { nodes: { id, kind }[], edges: { from, to }[] }; edge direction is not specified, so edges are compared as opaque from->to strings.
  const edgeSet = (): Set<string> => new Set(inspect().edges.map((e) => `${e.from}->${e.to}`));

  it("mount then dispose restores the reactive graph's subscription edges to the pre-mount set and later writes change no DOM", async () => {
    const binding = fc.record({
      kind: fc.constantFrom("text", "attr", "prop", "on"),
      src: fc.nat({ max: 7 }),
    });
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 4 }),
        fc.integer({ min: 0, max: 3 }),
        fc.array(binding, { minLength: 1, maxLength: 6 }),
        async (nSignals, nComputeds, bindings) => {
          const el = document.createElement("div");
          const { value: sources, dispose: endScope } = inScope(() => {
            const sigs: Signal<number>[] = [];
            for (let i = 0; i < nSignals; i++) sigs.push(signal(i));
            const comps: Computed<number>[] = [];
            for (let i = 0; i < nComputeds; i++) {
              const dep = sigs[i % nSignals];
              if (dep === undefined) throw new Error("no signal");
              comps.push(computed(() => dep.get() * 2));
            }
            return { sigs, all: [...sigs, ...comps] };
          });
          const read = (n: number): number => {
            const r = sources.all[n % sources.all.length];
            if (r === undefined) throw new Error("no source");
            return r.get();
          };
          try {
            // Warm each computed once so its own lazy source link (owned outside the tree) is in the pre-mount set.
            for (const c of sources.all) c.get();
            const before = edgeSet();
            const dispose = mount(() => {
              const r = clone(T);
              const b = r.querySelector("#b");
              if (b === null) throw new Error("no #b");
              effect(() => void read(0), { writes: [] });
              for (const { kind, src } of bindings) {
                if (kind === "text") text(b, () => String(read(src)));
                else if (kind === "attr") attr(b, `data-a${src}`, () => String(read(src)));
                else if (kind === "prop") prop(b, "title", () => String(read(src)));
                else on("b", "click", () => void src);
              }
              return r;
            }, el);
            await flush();
            const during = edgeSet();
            expect(during.size).toBeGreaterThan(before.size);
            dispose();
            await flush();
            expect([...edgeSet()].sort()).toEqual([...before].sort());
            const html = el.innerHTML;
            sources.sigs.forEach((sg, i) => sg.set(100 + i));
            await flush();
            expect(el.innerHTML).toBe(html);
          } finally {
            endScope();
          }
        },
      ),
      { seed: SEED, numRuns: 40 },
    );
  });
});

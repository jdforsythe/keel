// @vitest-environment happy-dom
// Property seed: 1337. k.runtime Events: innermost first, stopPropagation honored, at any nesting depth.
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { mount } from "../src/index.ts";
import { clone, on, template } from "../src/ops/index.ts";
import { SEED, fire } from "./support.ts";

const chain = (depth: number): string => {
  let html = `<i id="n${depth - 1}"></i>`;
  for (let i = depth - 2; i >= 0; i--) html = `<i id="n${i}">${html}</i>`;
  return `<div id="top">${html}</div>`;
};

describe("delegation order over random nesting depth", () => {
  it("handlers on any subset of ancestors run innermost first and stop at the first stopPropagation", () => {
    const scenario = fc.integer({ min: 1, max: 12 }).chain((depth) =>
      fc.record({
        depth: fc.constant(depth),
        bound: fc.subarray(Array.from({ length: depth }, (_, i) => i)),
        stop: fc.option(fc.integer({ min: 0, max: depth - 1 }), { nil: null }),
        target: fc.integer({ min: 0, max: depth - 1 }),
        type: fc.constantFrom("click", "input", "keydown", "pointerdown"),
      }),
    );
    fc.assert(
      fc.property(scenario, ({ depth, bound, stop, target, type }) => {
        const log: number[] = [];
        let outside = 0;
        const outer = document.createElement("section");
        const host = document.createElement("div");
        outer.appendChild(host);
        outer.addEventListener(type, () => outside++);
        const T = template(chain(depth));
        const dispose = mount(() => {
          const r = clone(T);
          for (const i of bound)
            on(`n${i}`, type, (e) => {
              log.push(i);
              if (stop === i) e.stopPropagation();
            });
          return r;
        }, host);
        const el = host.querySelector(`#n${target}`);
        if (el === null) throw new Error("no target");
        fire(el, type);
        const path = bound.filter((i) => i <= target).sort((a, b) => b - a);
        const cut = stop === null ? -1 : path.indexOf(stop);
        const expected = cut < 0 ? path : path.slice(0, cut + 1);
        expect(log).toEqual(expected);
        expect(outside).toBe(cut < 0 ? 1 : 0);
        dispose();
      }),
      { seed: SEED, numRuns: 150 },
    );
  });

  it("repeated renders with the same element id each get their own handler", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 6 }), fc.nat(), (n, pick) => {
        const hits: number[] = [];
        const UL = template("<ul></ul>");
        const LI = template('<li><button id="row.btn">x</button></li>');
        // Same element id in every row: handlers are keyed by element, not by id string.
        const host2 = document.createElement("div");
        const ROWS = Array.from({ length: n }, (_, k) => k);
        const dispose2 = mount(() => {
          const ul = clone(UL);
          for (const k of ROWS) {
            const li = clone(LI);
            on("row.btn", "click", () => hits.push(k));
            ul.appendChild(li);
          }
          return ul;
        }, host2);
        const buttons = host2.querySelectorAll("button");
        const b = buttons[pick % n];
        if (b === undefined) throw new Error("no button");
        fire(b, "click");
        expect(hits).toEqual([pick % n]);
        dispose2();
      }),
      { seed: SEED, numRuns: 30 },
    );
  });

  it("a mount nested inside another mount's tree runs each element's handler once per event", () => {
    fc.assert(
      fc.property(fc.constantFrom("click", "input", "keydown"), fc.boolean(), (type, stop) => {
        const log: string[] = [];
        const OUTER = template('<div id="outer"><section id="slot"></section></div>');
        const INNER = template('<p id="p"><button id="btn">b</button></p>');
        const host = document.createElement("div");
        const disposeOuter = mount(() => {
          const r = clone(OUTER);
          on("outer", type, () => log.push("outer"));
          on("slot", type, () => log.push("slot"));
          return r;
        }, host);
        const slot = host.querySelector("#slot");
        if (slot === null) throw new Error("no #slot");
        const disposeInner = mount(() => {
          const r = clone(INNER);
          on("btn", type, (e) => {
            log.push("btn");
            if (stop) e.stopPropagation();
          });
          on("p", type, () => log.push("p"));
          return r;
        }, slot);
        const btn = host.querySelector("#btn");
        if (btn === null) throw new Error("no #btn");
        fire(btn, type);
        expect(log).toEqual(stop ? ["btn"] : ["btn", "p", "slot", "outer"]);
        disposeInner();
        disposeOuter();
      }),
      { seed: SEED, numRuns: 20 },
    );
  });
});

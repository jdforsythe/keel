import { createCtx } from "@keel/ctx";
import { mount } from "@keel/runtime-dom";
import { clone, on, template } from "@keel/runtime-dom/ops";
// @vitest-environment happy-dom
// Spec: k.runtime, clause "A handler on an inner element runs before one on its ancestor; `stopPropagation` in the inner handler prevents the outer one."
// Property seed: 1337.
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, click } from "./fixtures.ts";

const simCtx = createCtx({ mode: "sim", seed: 1337 });

const chain = (depth: number): string => {
  let html = `<i id="n${depth - 1}"></i>`;
  for (let i = depth - 2; i >= 0; i--) html = `<i id="n${i}">${html}</i>`;
  return html;
};

// n0 is the outermost element, n(depth-1) the innermost.
const run = (depth: number, stopAt: number | null): string[] => {
  const log: string[] = [];
  const el = document.createElement("div");
  const T = template(`<div>${chain(depth)}</div>`);
  const dispose = mount(
    () => {
      const r = clone(T);
      for (let i = 0; i < depth; i++) {
        on(`n${i}`, "click", (e: Event) => {
          log.push(`n${i}`);
          if (stopAt === i) e.stopPropagation();
        });
      }
      return r;
    },
    el,
    { ctx: simCtx },
  );
  const target = el.querySelector(`#n${depth - 1}`);
  if (target === null) throw new Error("no target");
  click(target);
  dispose();
  return log;
};

describe("k.runtime: inner handler runs before ancestor; stopPropagation prevents the outer one", () => {
  it("a handler on an inner element runs before one on its ancestor", () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 6 }), (depth) => {
        const expected = Array.from({ length: depth }, (_, k) => `n${depth - 1 - k}`);
        expect(run(depth, null)).toEqual(expected);
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  it("stopPropagation in the inner handler prevents the outer one", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 6 }).chain((d) => fc.tuple(fc.constant(d), fc.integer({ min: 0, max: d - 1 }))),
        ([depth, stop]) => {
          const expected = Array.from({ length: depth - stop }, (_, k) => `n${depth - 1 - k}`);
          expect(run(depth, stop)).toEqual(expected);
        },
      ),
      { seed: SEED, numRuns: 30 },
    );
  });
});

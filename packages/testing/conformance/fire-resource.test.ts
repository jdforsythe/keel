// @vitest-environment happy-dom
// Spec: k.testing, clause "`fire` resolves only after every effect and resource it triggered has settled." Seed: 1337.
// The event starts a resource whose promise needs many microtask hops (up to 24, more than one settle round of 16); no timer, no `settle()` call.
import type { Ctx } from "@keel/ctx";
import { resource, signal } from "@keel/reactive";
import { clone, on, template, text } from "@keel/runtime-dom/ops";
import { s } from "@keel/schema";
import { render } from "@keel/testing";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, simCtx } from "./fixtures.ts";

type Slots = Record<string, unknown> | undefined;

const hops = async (n: number): Promise<void> => {
  for (let i = 0; i < n; i++) await Promise.resolve();
};

const T = template('<div><button id="load" data-k="load">load</button><p id="result"></p></div>');

// Clicking #load bumps `want`; the resource re-fetches for the new value after `depth` microtask hops.
const makeLoader = (depth: number) =>
  Object.assign(
    (_props: Record<string, never>, _slots?: Slots, _ctx?: Ctx): Node => {
      const want = signal(0);
      const res = resource(async () => {
        const n = want.get();
        if (n === 0) return "idle";
        await hops(depth);
        return `loaded:${n}`;
      });
      const root = clone(T);
      const out = root instanceof Element ? root.querySelector("#result") : null;
      if (out === null) throw new Error("fixture: no #result");
      text(out, () => {
        const v = res.get();
        return v.state === "ready" ? v.value : v.state;
      });
      on("load", "click", () => want.set(want.get() + 1));
      return root;
    },
    { Props: s.object({}) },
  );

describe("k.testing: fire resolves only after every resource it triggered has settled", () => {
  it("after awaiting fire, the resource's ready value is visible with no settle() and no timers", async () => {
    const t = render(makeLoader(24), { props: {}, ctx: simCtx() });
    await t.settle();
    expect(t.find("result").text).toBe("idle");
    await t.fire("load", { type: "click" });
    expect(t.find("result").text).toBe("loaded:1");
    t.dispose();
  });

  it("for any promise depth and click count, the last triggered resource value is visible after each fire", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 24 }), fc.integer({ min: 1, max: 4 }), async (depth, clicks) => {
        const t = render(makeLoader(depth), { props: {}, ctx: simCtx() });
        await t.settle();
        for (let i = 1; i <= clicks; i++) {
          await t.fire("load", { type: "click" });
          expect(t.find("result").text).toBe(`loaded:${i}`);
        }
        t.dispose();
      }),
      { seed: SEED, numRuns: 20 },
    );
  });
});

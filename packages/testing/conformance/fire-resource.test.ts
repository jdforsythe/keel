// @vitest-environment happy-dom
// Spec: k.testing, clause "`fire` resolves only once every effect and resource it triggered has settled."
// Seed: 1337.
// The event starts a resource whose promise needs many microtask hops (no cap: up to 2000); no timer, no `settle()` call.
import type { Ctx } from "@keel/ctx";
import { effect, resource, scope, signal } from "@keel/reactive";
import { clone, on, template, text } from "@keel/runtime-dom/ops";
import { s } from "@keel/schema";
import { store, transaction, tx } from "@keel/store";
import { render } from "@keel/testing";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, simCtx } from "./fixtures.ts";

const hops = async (n: number): Promise<void> => {
  for (let i = 0; i < n; i++) await Promise.resolve();
};

const T = template('<div><button id="load" data-k="load">load</button><p id="result"></p></div>');

// Clicking #load bumps `want`; the resource re-fetches for the new value after `depth` microtask hops.
const makeLoader = (depth: number) =>
  Object.assign(
    (_props: Record<string, never>): Node => {
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

// Uncapped depth, chained resources, and a store write after a resource resolves.
const DoneStore = s.object({ done: s.string() });
const made = (() => {
  let out: { done: ReturnType<typeof mk>["done"]; setDone: ReturnType<typeof mk>["setDone"] } | undefined;
  scope(() => {
    out = mk();
  });
  if (out === undefined) throw new Error("fixture: scope did not run");
  return out;
})();
function mk() {
  const done = store(DoneStore, { done: "none" }, { id: "fire.done" });
  const setDone = transaction(done, "fire.setDone", s.object({ done: s.string() }), (_state, p) => p);
  return { done, setDone };
}
const { done, setDone } = made;

const T2 = template(
  '<div><button id="go" data-k="go">go</button><p id="first"></p><p id="second"></p><p id="stored"></p></div>',
);

// Click -> resource A (depth hops) -> resource B, which reads A and awaits depthB hops -> effect writes the store.
const makeChain = (depthA: number, depthB: number) =>
  Object.assign(
    (_props: Record<string, never>): Node => {
      done.uses([setDone]);
      const want = signal(0);
      const a = resource(async () => {
        const n = want.get();
        if (n === 0) return "idle";
        await hops(depthA);
        return `a:${n}`;
      });
      const b = resource(async () => {
        const v = a.get();
        if (v.state !== "ready" || v.value === "idle") return "idle";
        await hops(depthB);
        return `b(${v.value})`;
      });
      // The transaction runs in a microtask the effect starts: an effect body may not write a store synchronously (E1201).
      effect(() => {
        const v = b.get();
        if (v.state === "ready" && v.value !== "idle") {
          const value = v.value;
          void Promise.resolve().then(() => tx(setDone, { done: value }));
        }
      });
      const root = clone(T2);
      const q = (id: string): Element => {
        const el = root instanceof Element ? root.querySelector(`#${id}`) : null;
        if (el === null) throw new Error(`fixture: no #${id}`);
        return el;
      };
      const show = (r: typeof a): string => {
        const v = r.get();
        return v.state === "ready" ? v.value : v.state;
      };
      text(q("first"), () => show(a));
      text(q("second"), () => show(b));
      text(q("stored"), () => done.get("done"));
      on("go", "click", () => want.set(want.get() + 1));
      return root;
    },
    { Props: s.object({}) },
  );

describe("k.testing: fire resolves after resources of any microtask depth, chained resources, and store writes", () => {
  it("for any resource depth from 1 to 2000 hops, the ready value is visible after fire with no settle() and no timers", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 2000 }), async (depth) => {
        const t = render(makeLoader(depth), { props: {}, ctx: simCtx() });
        await t.settle();
        await t.fire("load", { type: "click" });
        expect(t.find("result").text).toBe("loaded:1");
        t.dispose();
      }),
      { seed: SEED, numRuns: 30 },
    );
  });

  it("a resource whose ready value triggers a second resource that awaits many hops is settled when fire resolves", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 2000 }), fc.integer({ min: 1, max: 2000 }), async (da, db) => {
        const t = render(makeChain(da, db), { props: {}, ctx: simCtx() });
        await t.fire("go", { type: "click" });
        expect(t.find("first").text).toBe("a:1");
        expect(t.find("second").text).toBe("b(a:1)");
        t.dispose();
      }),
      { seed: SEED, numRuns: 30 },
    );
  });

  it("an effect that writes a store via a transaction after the resource resolves is visible in state(store) after fire", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 2000 }), fc.integer({ min: 1, max: 2000 }), async (da, db) => {
        const t = render(makeChain(da, db), { props: {}, ctx: simCtx(), state: [[done, { done: "none" }]] });
        expect(t.state(done)).toEqual({ done: "none" });
        await t.fire("go", { type: "click" });
        expect(t.state(done)).toEqual({ done: "b(a:1)" });
        expect(t.find("stored").text).toBe("b(a:1)");
        t.dispose();
      }),
      { seed: SEED, numRuns: 30 },
    );
  });
});

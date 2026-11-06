// @vitest-environment happy-dom
// Spec: k.testing, clause "Inside a harness render, `ctx.clock.now()` returns the sim clock's value, and two runs with one seed produce equal `state()`." Seed: 1337.
// Default sim: `render` without a `ctx` builds a sim ctx from KEEL_SEED (default 1337); state that depends on the seed is equal for one seed.
import { type Ctx, createCtx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import { attr, clone, on, template, text } from "@keel/runtime-dom/ops";
import { s } from "@keel/schema";
import { store, transaction, tx } from "@keel/store";
import { render } from "@keel/testing";
import * as fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import { ClockView, SEED } from "./fixtures.ts";

const RollSchema = s.object({ r: s.number(), at: s.number() });
type Slots = Record<string, unknown> | undefined;

const build = () => {
  const roll = store(RollSchema, { r: 0, at: 0 }, { id: "sim.roll" });
  const setRoll = transaction(roll, "sim.setRoll", s.object({ r: s.number(), at: s.number() }), (_state, p) => p);
  return { roll, setRoll };
};

// The store and transaction live in one never-disposed root scope (E1203).
const made = (() => {
  let out: ReturnType<typeof build> | undefined;
  scope(() => {
    out = build();
  });
  if (out === undefined) throw new Error("fixture: scope did not run");
  return out;
})();
const { roll, setRoll } = made;

const T = template('<div><button id="sim.roll" data-k="sim.roll">roll</button><p id="sim.r"></p></div>');
const RollView = Object.assign(
  (_props: Record<string, never>, _slots?: Slots, ctx?: Ctx): Node => {
    if (ctx === undefined) throw new Error("fixture: ctx not passed to component");
    roll.uses([setRoll]);
    const root = clone(T);
    const p = root instanceof Element ? root.querySelector("[id='sim.r']") : null;
    if (p === null) throw new Error("fixture: no #sim.r");
    text(p, () => String(roll.get("r")));
    attr(p, "data-at", () => roll.get("at"));
    on("sim.roll", "click", () => {
      tx(setRoll, { r: ctx.random.float(), at: ctx.clock.now() });
    });
    return root;
  },
  { Props: s.object({}) },
);

const withSeed = async <T>(seed: number | undefined, fn: () => Promise<T>): Promise<T> => {
  const prev = process.env.KEEL_SEED;
  if (seed === undefined) Reflect.deleteProperty(process.env, "KEEL_SEED");
  else process.env.KEEL_SEED = String(seed);
  try {
    return await fn();
  } finally {
    if (prev === undefined) Reflect.deleteProperty(process.env, "KEEL_SEED");
    else process.env.KEEL_SEED = prev;
  }
};

const rolled = async (): Promise<string> => {
  const t = render(RollView, { props: {}, state: [[roll, { r: 0, at: 0 }]] });
  await t.fire("sim.roll", { type: "click" });
  const state = JSON.stringify(t.state());
  t.dispose();
  return state;
};

afterEach(() => Reflect.deleteProperty(process.env, "KEEL_SEED"));

describe("k.testing: a render without a ctx runs under the default sim", () => {
  it("ctx.clock.now() is the sim clock's start value (0) in a render with no ctx option", async () => {
    await withSeed(undefined, async () => {
      const t = render(ClockView, { props: {} });
      expect(t.find("clock.now").text).toBe("0");
      t.dispose();
    });
  });

  it("one KEEL_SEED gives one state() across runs, and the seed is what varies it", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 0, max: 100000 }), async (seed) => {
        const a = await withSeed(seed, rolled);
        const b = await withSeed(seed, rolled);
        expect(b).toBe(a);
      }),
      { seed: SEED, numRuns: 25 },
    );
    const states = new Set<string>();
    for (const seed of [1, 2, 3, 4, 5]) states.add(await withSeed(seed, rolled));
    expect(states.size).toBeGreaterThan(1);
  });

  it("the state really depends on the seed: the rolled value is not the initial one", async () => {
    const state = await withSeed(7, rolled);
    expect(JSON.parse(state)["sim.roll"].r).not.toBe(0);
  });

  it("without KEEL_SEED the default seed is 1337: a render with no ctx equals a render with createCtx sim 1337", async () => {
    const viaDefault = await withSeed(undefined, rolled);
    const t = render(RollView, {
      props: {},
      state: [[roll, { r: 0, at: 0 }]],
      ctx: createCtx({ mode: "sim", seed: 1337 }),
    });
    await t.fire("sim.roll", { type: "click" });
    const explicit = JSON.stringify(t.state());
    t.dispose();
    expect(viaDefault).toBe(explicit);
  });
});

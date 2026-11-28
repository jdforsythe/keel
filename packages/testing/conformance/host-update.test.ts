// @vitest-environment happy-dom
// Spec: k.host-element, clause "Writing the signal `value` three times in one frame calls `update` once, with the last value and the mounted value as `prev`."
// Spec: k.host-element, clause "A plain `value` calls `mount` once and `update` never; writing a signal `value` to a new value and back in one frame calls no `update`."
// k.host-code, Code "`update(state, value, prev)`, optional: with none, a change of value calls nothing. `prev` is the value the last call got. Values pass by reference, never copied: an unchanged store or loader value keeps its identity, so `value.points !== prev.points` skips work."
// k.host-element, Lifecycle "While mounted, a change of `value` (by `Object.is`) calls `update` at most once per animation frame, with the latest value. A change requests a frame when none is pending; in the frame `update` runs unless the latest value `Object.is` the one the last call got, so a write and its reversal in one frame call nothing."
// k.host-element, Value "`value` is a plain value, read once; a signal or a computed, read with `get()`; or a compiled expression, the getter that `value={...}` compiles to (k.component), read again when what it reads changes. A function is a plain value, never called."
// A compiled getter needs the Keel compiler, which a direct `Host({...})` call does not run: that form is untestable in this file.
// Seed: 1337.
import { mount } from "@keel/runtime-dom";
import { Host } from "@keel/ui";
import fc from "fast-check";
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, computed, host, signal } from "./host-dom.ts";
import { Points, type PointsValue, SEED, flush, frames, probe, simCtx } from "./host-support.ts";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const mounted = async (value: ReturnType<typeof signal<PointsValue>>) => {
  const f = frames();
  const p = probe();
  mount(
    () =>
      Host({ id: "h.chart", role: "img", label: "Chart", input: Points, value, code: () => Promise.resolve(p.code) }),
    host(),
    { ctx: simCtx() },
  );
  await flush();
  f.step();
  await flush();
  return { f, ...p };
};

describe("k.host-element: update", () => {
  test("Writing the signal `value` three times in one frame calls `update` once, with the last value and the mounted value as `prev`", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(fc.integer(), { minLength: 3, maxLength: 3 }), async (writes) => {
        const first: PointsValue = { points: [0] };
        const sig = signal(first);
        const { f, log } = await mounted(sig);
        const values = writes.map((n): PointsValue => ({ points: [n] }));
        for (const v of values) sig.set(v);
        await flush();
        f.step();
        expect(log.updates).toHaveLength(1);
        expect(log.updates[0]?.value).toBe(values[2]);
        expect(log.updates[0]?.prev).toBe(first);
        vi.unstubAllGlobals();
      }),
      { seed: SEED, numRuns: 10 },
    );
  });

  test("`update` is called at most once per animation frame, and again in the next frame for a later write", async () => {
    const sig = signal<PointsValue>({ points: [0] });
    const { f, log } = await mounted(sig);
    sig.set({ points: [1] });
    await flush();
    f.step();
    f.step();
    expect(log.updates).toHaveLength(1);
    const second: PointsValue = { points: [2] };
    sig.set(second);
    await flush();
    f.step();
    expect(log.updates).toHaveLength(2);
    expect(log.updates[1]?.value).toBe(second);
  });

  test("a write of the same value (by `Object.is`) calls no `update`", async () => {
    const same: PointsValue = { points: [1] };
    const sig = signal(same);
    const { f, log } = await mounted(sig);
    sig.set(same);
    await flush();
    f.step();
    expect(log.updates).toEqual([]);
  });

  test("values pass by reference: `value` and `prev` are the objects the app wrote, and an unchanged member keeps its identity", async () => {
    const points = [1, 2, 3];
    const first: PointsValue = { points };
    const sig = signal(first);
    const { f, log } = await mounted(sig);
    expect(log.mounts[0]?.value).toBe(first);
    const next: PointsValue = { points };
    sig.set(next);
    await flush();
    f.step();
    expect(log.updates[0]?.value).toBe(next);
    expect(log.updates[0]?.prev).toBe(first);
    expect(log.updates[0]?.value.points).toBe(log.updates[0]?.prev.points);
  });

  test("a plain `value` calls `mount` once and `update` never", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(fc.integer(), { maxLength: 5 }), async (points) => {
        const f = frames();
        const p = probe();
        const plain: PointsValue = { points };
        mount(
          () =>
            Host({
              id: "h.chart",
              role: "img",
              label: "Chart",
              input: Points,
              value: plain,
              code: () => Promise.resolve(p.code),
            }),
          host(),
          { ctx: simCtx() },
        );
        await flush();
        f.step();
        await flush();
        f.step();
        expect(p.log.mounts).toHaveLength(1);
        expect(p.log.mounts[0]?.value).toBe(plain);
        expect(p.log.updates).toEqual([]);
        vi.unstubAllGlobals();
      }),
      { seed: SEED, numRuns: 10 },
    );
  });

  test("writing a signal `value` to a new value and back in one frame calls no `update`", async () => {
    const first: PointsValue = { points: [1] };
    const sig = signal(first);
    const { f, log } = await mounted(sig);
    sig.set({ points: [2] });
    sig.set(first);
    await flush();
    f.step();
    expect(log.updates).toEqual([]);
  });

  test("a computed `value` is read with `get()`: a change of what it reads calls `update` once with the computed's value", async () => {
    const n = signal(1);
    const derived = computed((): PointsValue => ({ points: [n.get()] }));
    const f = frames();
    const p = probe();
    mount(
      () =>
        Host({
          id: "h.chart",
          role: "img",
          label: "Chart",
          input: Points,
          value: derived,
          code: () => Promise.resolve(p.code),
        }),
      host(),
      { ctx: simCtx() },
    );
    await flush();
    f.step();
    await flush();
    expect(p.log.mounts[0]?.value).toEqual({ points: [1] });
    n.set(2);
    n.set(3);
    await flush();
    f.step();
    expect(p.log.updates).toHaveLength(1);
    expect(p.log.updates[0]?.value).toEqual({ points: [3] });
    expect(p.log.updates[0]?.prev).toEqual({ points: [1] });
  });

  test("a function `value` is a plain value: it is never called, `mount` gets it as given, and `update` never runs", async () => {
    const f = frames();
    const calls: number[] = [];
    const fn = Object.assign(() => calls.push(1), { points: [1] });
    const p = probe();
    mount(
      () =>
        Host({
          id: "h.chart",
          role: "img",
          label: "Chart",
          input: Points,
          value: fn,
          code: () => Promise.resolve(p.code),
        }),
      host(),
      { ctx: simCtx() },
    );
    await flush();
    f.step();
    await flush();
    f.step();
    expect(calls).toEqual([]);
    expect(p.log.mounts[0]?.value).toBe(fn);
    expect(p.log.updates).toEqual([]);
  });
});

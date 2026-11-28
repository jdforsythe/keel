// Seed 1337. Unit and property tests for observe, report and seedOf (k.ctx Observers, rfc:0070).
import fc from "fast-check";
import { expect, test } from "vitest";
import type { CtxEvent } from "../src/CtxEvent.ts";
import type { Mode } from "../src/Mode.ts";
import { createCtx } from "../src/createCtx.ts";
import { observed } from "../src/internal/observed.ts";
import { report } from "../src/internal/report.ts";
import { observe } from "../src/observe.ts";
import { seedOf } from "../src/seedOf.ts";

const SEED = 1337;
const nav = (id: string): CtxEvent => ({
  kind: "nav",
  href: `/${id}`,
  route: { id, path: `/${id}`, params: {}, search: {}, schemas: {} },
});
const ev = fc.oneof(
  fc.stringMatching(/^[a-z]{1,4}$/).map(nav),
  fc.stringMatching(/^[a-z]{1,4}$/).map((id): CtxEvent => ({ kind: "fire", id, event: { type: "click" } })),
  fc
    .constantFrom<"loading" | "ready" | "error">("loading", "ready", "error")
    .map((state): CtxEvent => ({ kind: "resource", id: "1", state })),
);

test("every reported event reaches each observer once, in report order, until its stop runs", () => {
  fc.assert(
    fc.property(fc.array(ev, { maxLength: 20 }), fc.nat(20), (events, cut) => {
      const ctx = createCtx({ mode: "sim" });
      const a: CtxEvent[] = [];
      const b: CtxEvent[] = [];
      const stopA = observe(ctx, (e) => a.push(e));
      observe(ctx, (e) => b.push(e));
      for (const [i, e] of events.entries()) {
        if (i === cut) stopA();
        report(ctx, e);
      }
      expect(b).toEqual(events);
      expect(a).toEqual(events.slice(0, Math.min(cut, events.length)));
    }),
    { seed: SEED, numRuns: 100 },
  );
});

test("a new observer first gets the current nav, reported even while nothing observed, with its report time", () => {
  const ctx = createCtx({ mode: "sim" });
  report(ctx, nav("a"));
  report(ctx, nav("b"));
  report(ctx, { kind: "fire", id: "x", event: { type: "click" } });
  const got: CtxEvent[] = [];
  observe(ctx, (e) => got.push(e));
  expect(got).toEqual([{ ...nav("b"), at: 0 }]);
});

test("a throwing observer is dropped per event and later observers still run", () => {
  const ctx = createCtx({ mode: "sim" });
  const got: string[] = [];
  observe(ctx, () => {
    throw new Error("boom");
  });
  observe(ctx, (e) => got.push(e.kind));
  expect(() => report(ctx, { kind: "error", error: { code: "x", message: "m", data: null } })).not.toThrow();
  expect(got).toEqual(["error"]);
});

test("stop is idempotent; observed() is false with no observer and for undefined", () => {
  const ctx = createCtx({ mode: "sim" });
  expect(observed(ctx)).toBe(false);
  expect(observed(undefined)).toBe(false);
  const stop = observe(ctx, () => undefined);
  expect(observed(ctx)).toBe(true);
  stop();
  stop();
  expect(observed(ctx)).toBe(false);
  expect(() => report(undefined, nav("a"))).not.toThrow();
});

test("an observer stopping itself mid-report does not skip the next observer", () => {
  const ctx = createCtx({ mode: "sim" });
  const got: string[] = [];
  const stop = observe(ctx, () => stop());
  observe(ctx, () => got.push("second"));
  report(ctx, { kind: "fire", id: "x", event: { type: "click" } });
  expect(got).toEqual(["second"]);
});

test("observers of one ctx never see another ctx's events", () => {
  const a = createCtx({ mode: "sim" });
  const b = createCtx({ mode: "sim" });
  const got: CtxEvent[] = [];
  observe(a, (e) => got.push(e));
  report(b, nav("b"));
  expect(got).toEqual([]);
});

test("seedOf is the seed given to createCtx in every mode, undefined when none was given", () => {
  fc.assert(
    fc.property(fc.nat(), fc.constantFrom<Mode>("sim", "real", "shell"), (seed, mode) => {
      expect(seedOf(createCtx({ mode, seed }))).toBe(seed);
      expect(seedOf(createCtx({ mode }))).toBeUndefined();
    }),
    { seed: SEED, numRuns: 50 },
  );
  expect(seedOf({ ...createCtx({ mode: "sim", seed: 3 }) })).toBeUndefined();
});

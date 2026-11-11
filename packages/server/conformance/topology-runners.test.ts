// @vitest-environment happy-dom
// Spec: k.topology, clause "`createApp({ runners })` runs each runner of the served deployable once, none of another; `close()` aborts their signals and resolves once each `run` settles; a rejected `run` runs again 1,000 ms later on the sim clock."
// Seed 1337 (fc.assert below). The restart delay is observed on the sim clock only.
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { topology } from "@keel/server";
import { SEED, createAppLoose, flush, pageManifest, simCtx } from "./topology-fixtures.ts";

type Run = (ctx: unknown, signal: AbortSignal) => Promise<void>;

describe("k.topology: runners", () => {
  test("`createApp({ runners })` runs each runner of the served deployable once, none of another; `close()` aborts their signals and resolves once each `run` settles; a rejected `run` runs again 1,000 ms later on the sim clock.", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 4 }), async (n) => {
        const t = topology({ x: { modules: ["a"], adapter: "node" }, y: { modules: ["b"], adapter: "node" } });
        const runs = { a: 0, b: 0 };
        const signals: AbortSignal[] = [];
        const release: (() => void)[] = [];
        const longRunning: Run = (_ctx, signal) => {
          runs.a++;
          signals.push(signal);
          return new Promise<void>((resolve) => {
            signal.addEventListener("abort", () => release.push(resolve));
          });
        };
        const other: Run = () => {
          runs.b++;
          return Promise.resolve();
        };
        const ctx = simCtx();
        const app = await createAppLoose({
          topology: t,
          deployable: "x",
          routes: pageManifest("a", "/a", "A"),
          ctx,
          runners: { a: Array.from({ length: n }, () => ({ run: longRunning })), b: [{ run: other }] },
        });
        await flush();
        expect(runs).toEqual({ a: n, b: 0 });
        expect(signals.every((s) => !s.aborted)).toBe(true);
        let closed = false;
        const closing = app.close?.().then(() => {
          closed = true;
        });
        await flush();
        expect(signals.every((s) => s.aborted)).toBe(true);
        for (const r of release) r();
        await closing;
        expect(closed).toBe(true);
      }),
      { seed: SEED, numRuns: 10 },
    );

    const ctx = simCtx();
    let starts = 0;
    const flaky: Run = () => {
      starts++;
      return starts === 1 ? Promise.reject(new Error("boom")) : new Promise<void>(() => undefined);
    };
    const app = await createAppLoose({
      topology: topology({ x: { modules: ["a"], adapter: "node" } }),
      routes: pageManifest("a", "/a", "A"),
      ctx,
      runners: { a: [{ run: flaky }] },
    });
    await flush();
    expect(starts).toBe(1);
    ctx.clock.advance(999);
    await flush();
    expect(starts).toBe(1);
    ctx.clock.advance(1);
    await flush();
    expect(starts).toBe(2);
    expect(app.close).toBeTypeOf("function");
  });
});

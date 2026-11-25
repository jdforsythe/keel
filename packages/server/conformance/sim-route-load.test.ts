// @vitest-environment happy-dom
// Spec: k.drive, Conformance "In an empty replay, with a `ctx.clock.after(10)` waiter pending, `renderRoute` given `app` and `routes` as `() => import(path)` resolves with `ctx.clock.now()` 0 and the waiter not resolved."
// Seed: 1337 (fc.assert below); replays use a SimRun of seed 1 and an empty schedule.
// Lives in packages/server/conformance because the case needs `createApp` (`@keel/testing` imports no server package).
// ASSUMPTION: `path` is the routes module of sim-route-load-routes.ts, which re-exports the page of render-route-document-support.ts as `routes`; the app is `createApp` over the same ctx, made inside the scenario.
import { renderRoute, simulate } from "@keel/testing";
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED, appOn } from "./render-route-document-support.ts";

const replay = { seed: 1, schedule: { net: [], storage: [], offline: [], plans: {} } };

async function loadWith(waiterMs: number): Promise<{ now: number; waiter: boolean; text: string }> {
  const seen: { now: number; waiter: boolean; text: string }[] = [];
  await simulate(
    async ({ ctx }) => {
      let resolved = false;
      const ac = new AbortController();
      const w = ctx.clock.after(waiterMs, ac.signal).then(
        () => {
          resolved = true;
        },
        () => undefined,
      );
      const app = await appOn(ctx);
      const opts = { routes: () => import("./sim-route-load-routes.ts"), ctx, app };
      const h = await renderRoute("f.page", opts);
      seen.push({ now: ctx.clock.now(), waiter: resolved, text: h.find("f.shown").text });
      h.dispose();
      ac.abort();
      await w;
    },
    { replay },
  );
  const first = seen[0];
  if (first === undefined) throw new Error("fixture: the scenario did not finish");
  return first;
}

test("In an empty replay, with a `ctx.clock.after(10)` waiter pending, `renderRoute` given `app` and `routes` as `() => import(path)` resolves with `ctx.clock.now()` 0 and the waiter not resolved.", async () => {
  expect(await loadWith(10)).toEqual({ now: 0, waiter: false, text: "" });
});

/** Generated waits the property case runs. */
const RUNS = 5;
/**
 * What the property case bounds: per run, an app made on a fresh replay and one renderRoute that imports its routes,
 * about 65 ms here on a quiet machine and up to 150 ms beside other work. The bound is 2,000 ms a run, so a runner ten
 * times slower (scale 0.1) still has 200 ms a run.
 */
const LOAD_BOUND = RUNS * 2_000;

test(
  "`renderRoute` given `app` and `routes` as an import resolves with the clock at 0 and the waiter not resolved, for a `ctx.clock.after(d)` waiter of any `d`",
  async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 60_000 }), async (d) => {
        expect(await loadWith(d)).toEqual({ now: 0, waiter: false, text: "" });
      }),
      { seed: SEED, numRuns: RUNS },
    );
  },
  LOAD_BOUND,
);

// @vitest-environment happy-dom
// Spec: std.sessions, clause "For an unmodified session of a page with no guard and `mount` the result of `identityMount('/auth')`, `replay(session, { routes, mount })` returns the same `observed`, `state`, `reproduced` and `unapplied` as `replay(session, { routes })`, and `minimize(session, { routes, mount })` the same result as `minimize(session, { routes })`."
// Spec: std.sessions, clause "With that `mount` and a `serve` resolving a `createApp` result, `replay(session, { routes, serve, mount })` and `minimize(session, { routes, serve, mount })` each reject with an error whose `code` is `'E1722'`, each after exactly one call of `serve`, and the app answers no request."
// Seed 1337 (the session's seed and the property seed). The unguarded page is the cart-bug fixture's; the served pages are fixtures/guarded's `a.about` and `a.help`.
// ASSUMPTION: "the app answers no request" is the app's `fetch` never called (`app.fetch` is wrapped and counted); E1722 is read as `code` on the rejection, as render-route-app-mount-e1722.test.ts does.
import { identityMount } from "@keel/router";
import { minimize } from "@keel/std-sessions/minimize";
import { replay } from "@keel/std-sessions/replay";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { buggyRoutes, buggySession } from "./fixtures.ts";
import { buildApp, guardedRoutes, recordServed } from "./served-fixtures.ts";

const mount = identityMount("/auth");
const codeOf = (e: unknown): unknown => (typeof e === "object" && e !== null ? Reflect.get(e, "code") : undefined);
const rejection = (p: Promise<unknown>): Promise<unknown> =>
  p.then(
    () => undefined,
    (x: unknown) => x,
  );

/** A `serve` counting its calls and the requests its app was asked. */
function watchedServe() {
  const calls: number[] = [];
  const requests: unknown[] = [];
  const serve = async (ctx: Parameters<typeof buildApp>[0]) => {
    calls.push(1);
    const app = await buildApp(ctx);
    const handle = app.fetch.bind(app);
    Object.defineProperty(app, "fetch", {
      value: (req: Request) => {
        requests.push(`${req.method} ${new URL(req.url).pathname}`);
        return handle(req);
      },
    });
    return app;
  };
  return { serve, calls, requests };
}

describe("std.sessions: replay and minimize with mount", () => {
  test("`replay(session, { routes, mount })` returns the same `observed`, `state`, `reproduced` and `unapplied` as `replay(session, { routes })`", async () => {
    const session = await buggySession();
    const without = await replay(session, { routes: buggyRoutes() });
    const withMount = await replay(session, { routes: buggyRoutes(), mount });
    expect(withMount.observed).toEqual(without.observed);
    expect(withMount.state).toEqual(without.state);
    expect(withMount.reproduced).toBe(without.reproduced);
    expect(withMount.unapplied).toBe(without.unapplied);
  }, 60_000);

  test("`mount` leaves `replay` unchanged for a session of any seed", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 0, max: 100_000 }), async (seed) => {
        const session = await buggySession(seed);
        const without = await replay(session, { routes: buggyRoutes() });
        const withMount = await replay(session, { routes: buggyRoutes(), mount });
        expect({
          o: withMount.observed,
          s: withMount.state,
          r: withMount.reproduced,
          u: withMount.unapplied,
        }).toEqual({ o: without.observed, s: without.state, r: without.reproduced, u: without.unapplied });
      }),
      { seed: 1337, numRuns: 4 },
    );
  }, 120_000);

  test("`minimize(session, { routes, mount })` returns the same result as `minimize(session, { routes })`", async () => {
    const session = await buggySession();
    const without = await minimize(session, { routes: buggyRoutes() });
    const withMount = await minimize(session, { routes: buggyRoutes(), mount });
    expect(withMount).toEqual(without);
  }, 120_000);

  test("`replay(session, { routes, serve, mount })` rejects with an error whose `code` is `'E1722'`, after exactly one call of `serve`, and the app answers no request", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.constantFrom("a.about" as const, "a.help" as const), { maxLength: 3 }),
        async (visits) => {
          const { session } = await recordServed("a.about", visits);
          const w = watchedServe();
          const e = await rejection(replay(session, { routes: guardedRoutes, serve: w.serve, mount }));
          expect(codeOf(e)).toBe("E1722");
          expect(w.calls).toHaveLength(1);
          expect(w.requests).toEqual([]);
        },
      ),
      { seed: 1337, numRuns: 6 },
    );
  }, 120_000);

  test("`minimize(session, { routes, serve, mount })` rejects with an error whose `code` is `'E1722'`, after exactly one call of `serve`, and the app answers no request", async () => {
    const { session } = await recordServed("a.about", ["a.help"]);
    const w = watchedServe();
    const e = await rejection(minimize(session, { routes: guardedRoutes, serve: w.serve, mount }));
    expect(codeOf(e)).toBe("E1722");
    expect(w.calls).toHaveLength(1);
    expect(w.requests).toEqual([]);
  }, 120_000);

  test("control: `serve` without `mount` does not reject", async () => {
    const { session } = await recordServed("a.about", []);
    const w = watchedServe();
    const r = await replay(session, { routes: guardedRoutes, serve: w.serve });
    expect(r.unapplied).toBeNull();
    expect(w.calls).toHaveLength(1);
  }, 120_000);
});

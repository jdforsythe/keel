// @vitest-environment happy-dom
// Spec: std.sessions-served, clause "`replay` with `serve` of an unmodified session recorded under `renderRoute` with `app` calls `serve` once and returns `reproduced: true`, `unapplied: null`, and every store's final state equal to the recording's."
// std.sessions-served, Served pages "With `serve(ctx)`, a function resolving a `createApp` result made on `ctx`, the base is a page a `node` deployable serves: `replay` makes the sim ctx, advances it to `at`, calls `serve(ctx)` once, and renders the base with `renderRoute(route.id, { routes, params, search, ctx, app, user })` (k.testing; `user` left out when absent), so guards, loaders and actions run in the app over `ctx.storage`, which starts empty."
// std.sessions-served, Served pages "`state` is not applied: each store starts as the served document resumes it."
// std.sessions-served, Served pages "App and page share the ctx's clock and random (k.mount Testing): `serve` gets the ctx with its clock at `at` and its random stream unread, both then draw from that stream, so two replays under one `seed` draw the same values and are equal; where the stream stands after a replay is not part of the result."
// std.sessions-served, Served pages "The server's data comes only from the recorded inputs replayed through the app (a submit runs its action), never from `state`."
// std.sessions-served, Served pages "The server state, loader answers and user of the recorded run are not in the session: a session whose error needs them does not reproduce (E2004)."
// Seed 1337
// Untestable here: that guards, loaders and actions "run in the app over `ctx.storage`" (the spec names no way to observe the storage a replay used), and `minimize` calling `serve` once per run (RFC 0215 Proposal, not in the spec text).
import { fixedTime } from "@keel/tooling/test-time";
import { createCtx } from "@keel/ctx";
import type { SimCtx } from "@keel/ctx";
import { replay } from "@keel/std-sessions/replay";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { AT, buildApp, countingServe, guardedRoutes, recordServed } from "./served-fixtures.ts";

const visitsArb = fc.array(fc.constantFrom("a.about" as const, "a.help" as const), { maxLength: 4 });

describe("std.sessions: replay with serve", () => {
  test(
    "`replay` with `serve` of an unmodified session recorded under `renderRoute` with `app` calls `serve` once and returns `reproduced: true`, `unapplied: null`, and every store's final state equal to the recording's",
    async () => {
      await fc.assert(
        fc.asyncProperty(visitsArb, async (visits) => {
          const { session, live } = await recordServed("a.about", visits);
          const { serve, ctxs } = countingServe();
          const r = await replay(session, { routes: guardedRoutes, serve });
          expect(ctxs).toHaveLength(1);
          expect(r.reproduced).toBe(true);
          expect(r.unapplied).toBeNull();
          expect(r.state).toEqual(live);
        }),
        { seed: 1337, numRuns: 12 },
      );
    },
    fixedTime(120_000),
  );

  test(
    "`replay` calls `serve` with the sim ctx of `seed`, its clock at `at` and its random stream unread",
    async () => {
      await fc.assert(
        fc.asyncProperty(fc.integer({ min: 0, max: 100_000 }), async (seed) => {
          const { session } = await recordServed("a.about", [], { seed });
          const seen: { now: number; id: string }[] = [];
          const serve = (ctx: SimCtx) => {
            seen.push({ now: ctx.clock.now(), id: ctx.random.id("Probe") });
            return buildApp(ctx);
          };
          await replay({ ...session, seed }, { routes: guardedRoutes, serve });
          expect(session.at).toBe(AT);
          expect(seen).toEqual([{ now: session.at, id: createCtx({ mode: "sim", seed }).random.id("Probe") }]);
        }),
        { seed: 1337, numRuns: 8 },
      );
    },
    fixedTime(120_000),
  );

  test(
    "`state` is not applied with `serve`: a session holding a recorded `state` replays as when it holds none",
    async () => {
      const { session } = await recordServed("a.about", ["a.help"]);
      const withState = { ...session, state: { "a.recorded": { n: 1 } } };
      const bare = await replay({ ...session, state: {} }, { routes: guardedRoutes, serve: countingServe().serve });
      const counted = countingServe();
      const r = await replay(withState, { routes: guardedRoutes, serve: counted.serve });
      expect(counted.ctxs).toHaveLength(1);
      expect(r.unapplied).toBeNull();
      expect(r.reproduced).toBe(true);
      expect(r.state).toEqual(bare.state);
    },
    fixedTime(120_000),
  );

  test(
    "a replay under one `seed` with `serve` is deterministic: two replays are equal",
    async () => {
      await fc.assert(
        fc.asyncProperty(visitsArb, async (visits) => {
          const { session } = await recordServed("a.about", visits);
          const a = countingServe();
          const b = countingServe();
          const one = await replay(session, { routes: guardedRoutes, serve: a.serve });
          const two = await replay(session, { routes: guardedRoutes, serve: b.serve });
          expect(a.ctxs.length + b.ctxs.length).toBe(2);
          expect(two).toEqual(one);
        }),
        { seed: 1337, numRuns: 6 },
      );
    },
    fixedTime(120_000),
  );

  test(
    "a session whose error the served app does not raise does not reproduce: `reproduced` is false and `error` is null",
    async () => {
      const { session } = await recordServed("a.about", []);
      const error = { code: "NEEDS_SERVER_STATE", message: "recorded against data the replay lacks", data: null };
      const failing = {
        ...session,
        error,
        fingerprint: "abcdef012345",
        events: [...session.events, { at: session.at, kind: "error" as const, route: "a.about", error }],
      };
      const counted = countingServe();
      const r = await replay(failing, { routes: guardedRoutes, serve: counted.serve });
      expect(counted.ctxs).toHaveLength(1);
      expect(r.reproduced).toBe(false);
      expect(r.error).toBeNull();
    },
    fixedTime(120_000),
  );
});

// @vitest-environment happy-dom
// Spec: std.sessions, clause "After overflow, a session holds at most `limit` events and its replay ends in the same `state()` as the live app."
// Seed 1337
import { replay } from "@keel/std-sessions/replay";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED, cartRoutes, play, stepArb } from "./fixtures.ts";

describe("std.sessions: overflow", () => {
  test("After overflow, a session holds at most `limit` events", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(stepArb, { minLength: 12, maxLength: 24 }),
        fc.integer({ min: 2, max: 6 }),
        async (script, limit) => {
          const { session } = await play(SEED, script, { limit });
          expect(session.events.length).toBeLessThanOrEqual(limit);
        },
      ),
      { seed: 1337, numRuns: 20 },
    );
  });

  test("and its replay ends in the same `state()` as the live app", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(stepArb, { minLength: 12, maxLength: 24 }),
        fc.integer({ min: 2, max: 6 }),
        async (script, limit) => {
          const { session, live } = await play(SEED, script, { limit });
          const r = await replay(session, { routes: cartRoutes() });
          expect(r.state).toEqual(live);
        },
      ),
      { seed: 1337, numRuns: 20 },
    );
  });
});

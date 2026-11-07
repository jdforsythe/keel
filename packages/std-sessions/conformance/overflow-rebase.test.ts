// @vitest-environment happy-dom
// Spec: std.sessions, clause "After overflow, the session starts at a navigation and its replay ends in the same `state()` as the live app."
// Seed 1337
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { replay } from "@keel/std-sessions";
import { SEED, cartRoutes, play, stepArb } from "./fixtures.ts";

// Gap: the spec does not say what the session holds when the overflowed buffer contains no `nav` at all, nor how a script navigates through the harness (no `navigate` on RouteHarness).
// TODO 0092: unskip
describe.skip("std.sessions: overflow", () => {
  test("After overflow, the session starts at a navigation", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(stepArb, { minLength: 12, maxLength: 24 }),
        fc.integer({ min: 2, max: 6 }),
        async (script, limit) => {
          const { session } = await play(SEED, script, { limit });
          expect(session.events.length).toBeLessThanOrEqual(limit + 1);
          const first = session.events[0];
          if (first !== undefined) expect(first.kind).toBe("nav");
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

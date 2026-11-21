// @vitest-environment happy-dom
// Spec: std.sessions, clause "Replaying an unmodified session reproduces every store's final state and its fingerprint."
// Seed 1337
import { replay } from "@keel/std-sessions/replay";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED, cartRoutes, play, stepArb } from "./fixtures.ts";

describe("std.sessions: replay", () => {
  test("Replaying an unmodified session reproduces every store's final state", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(stepArb, { maxLength: 10 }), async (script) => {
        const { session, live } = await play(SEED, script);
        const r = await replay(session, { routes: cartRoutes() });
        expect(r.state).toEqual(live);
      }),
      { seed: 1337, numRuns: 20 },
    );
  });

  test("Replaying an unmodified session reproduces its fingerprint", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(stepArb, { maxLength: 10 }), async (script) => {
        const { session } = await play(SEED, script);
        const r = await replay(session, { routes: cartRoutes() });
        expect(r.reproduced).toBe(true);
        expect(r.error?.code ?? null).toBe(session.error?.code ?? null);
      }),
      { seed: 1337, numRuns: 20 },
    );
  });
});

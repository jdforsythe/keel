// @vitest-environment happy-dom
// Spec: std.sessions, clause "Under one sim seed, one script of fires produces byte-equal sessions; events are in occurrence order with `at` equal to `ctx.clock.now()` then."
// Seed 1337
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED, json, play, stepArb } from "./fixtures.ts";

describe("std.sessions: determinism and event order", () => {
  test("Under one sim seed, one script of fires produces byte-equal sessions", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(stepArb, { maxLength: 8 }), async (script) => {
        const a = await play(SEED, script);
        const b = await play(SEED, script);
        expect(json(a.session)).toBe(json(b.session));
      }),
      { seed: 1337, numRuns: 20 },
    );
  });

  test("events are in occurrence order with `at` equal to `ctx.clock.now()` then", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(stepArb, { maxLength: 8 }), async (script) => {
        const { session, times } = await play(SEED, script);
        const ats = session.events.map((e) => e.at);
        expect(ats).toEqual([...ats].sort((x, y) => x - y));
        // every fire event was recorded at the sim clock reading when its fire resolved or began
        const fires = session.events.filter((e) => e.kind === "fire").map((e) => e.at);
        expect(fires.length).toBe(times.length);
        for (const [i, at] of fires.entries()) expect(at).toBe(times[i]);
      }),
      { seed: 1337, numRuns: 20 },
    );
  });
});

// std.multi Schedules: users split a group schedule's net steps round-robin and share its offline windows.
// Seed 1337
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { userSchedule } from "../src/group/internal/userSchedule.ts";

const fault = fc.constantFrom<"none" | "drop" | "lost" | "unavailable">("none", "drop", "lost", "unavailable");
const scheduleArb = fc.record({
  net: fc.array(fc.record({ delay: fc.integer({ min: 0, max: 60000 }), fault }), { maxLength: 12 }),
  storage: fc.array(fc.constantFrom<"ok" | "fail">("ok", "fail"), { maxLength: 3 }),
  offline: fc.array(fc.record({ at: fc.nat(), ms: fc.nat() }), { maxLength: 2 }),
  plans: fc.constant({}),
});

describe("userSchedule", () => {
  test("user i of n gets net steps i, i + n, ...; every step goes to exactly one user", () => {
    fc.assert(
      fc.property(scheduleArb, fc.integer({ min: 1, max: 4 }), (schedule, n) => {
        const parts = Array.from({ length: n }, (_, i) => userSchedule(schedule, i, n));
        for (const [i, p] of parts.entries()) {
          expect(p.net).toEqual(schedule.net.filter((_, k) => k % n === i));
          expect(p.offline).toEqual(schedule.offline);
          expect([p.storage, p.plans]).toEqual([[], {}]);
        }
        expect(parts.reduce((a, p) => a + p.net.length, 0)).toBe(schedule.net.length);
      }),
      { seed: 1337, numRuns: 100 },
    );
  });
});

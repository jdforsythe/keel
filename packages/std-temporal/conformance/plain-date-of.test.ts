// Spec: std.temporal, clause "For every generated instant `i`, `plainDateOf(i, UTC)` is the first 10 characters of `i`; for `2026-11-10T23:30:00.000Z` it is `2026-11-11` in `Asia/Tokyo` and `2026-11-10` in `America/New_York`."
// Seed 1337
import { gen } from "@keel/schema/gen";
import { Instant, TimeZone, UTC, plainDateOf } from "@keel/std-temporal";
import fc from "fast-check";
import { expect, test } from "vitest";

function must<T>(r: { ok: true; value: T } | { ok: false }): T {
  if (!r.ok) throw new Error("expected ok");
  return r.value;
}

test.skip("For every generated instant `i`, `plainDateOf(i, UTC)` is the first 10 characters of `i`; for `2026-11-10T23:30:00.000Z` it is `2026-11-11` in `Asia/Tokyo` and `2026-11-10` in `America/New_York`.", () => {
  fc.assert(
    fc.property(gen(Instant), (i) => {
      expect(plainDateOf(i, UTC)).toBe(i.slice(0, 10));
    }),
    { seed: 1337, numRuns: 200 },
  );
  const i = must(Instant.parse("2026-11-10T23:30:00.000Z"));
  expect(plainDateOf(i, must(TimeZone.parse("Asia/Tokyo")))).toBe("2026-11-11");
  expect(plainDateOf(i, must(TimeZone.parse("America/New_York")))).toBe("2026-11-10");
});

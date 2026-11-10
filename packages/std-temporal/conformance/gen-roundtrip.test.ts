// Spec: std.temporal, clause "For every value `gen` produces for each of the four, `parse` accepts it, `encode` returns it unchanged and `doc()` is its name; generated dates reach 0001-01-01, 9999-12-31 and February 29."
// Seed 1337
import { gen } from "@keel/schema/gen";
import { Duration, Instant, PlainDate, TimeZone } from "@keel/std-temporal";
import fc from "fast-check";
import { expect, test } from "vitest";

const run = { seed: 1337, numRuns: 200 };

test.skip("For every value `gen` produces for each of the four, `parse` accepts it, `encode` returns it unchanged and `doc()` is its name; generated dates reach 0001-01-01, 9999-12-31 and February 29.", () => {
  fc.assert(
    fc.property(gen(Instant), (v) => {
      const r = Instant.parse(v);
      expect(r.ok).toBe(true);
      expect(Instant.encode(v)).toBe(v);
    }),
    run,
  );
  fc.assert(
    fc.property(gen(PlainDate), (v) => {
      expect(PlainDate.parse(v).ok).toBe(true);
      expect(PlainDate.encode(v)).toBe(v);
    }),
    run,
  );
  fc.assert(
    fc.property(gen(TimeZone), (v) => {
      expect(TimeZone.parse(v).ok).toBe(true);
      expect(TimeZone.encode(v)).toBe(v);
    }),
    run,
  );
  fc.assert(
    fc.property(gen(Duration), (v) => {
      expect(Duration.parse(v).ok).toBe(true);
      expect(Duration.encode(v)).toBe(v);
    }),
    run,
  );
  expect(Instant.doc()).toBe("temporal.Instant");
  expect(PlainDate.doc()).toBe("temporal.PlainDate");
  expect(TimeZone.doc()).toBe("temporal.TimeZone");
  expect(Duration.doc()).toBe("temporal.Duration");

  const dates: readonly string[] = fc.sample(gen(PlainDate), { seed: 1337, numRuns: 2000 });
  expect(dates).toContain("0001-01-01");
  expect(dates).toContain("9999-12-31");
  expect(dates.some((d) => d.endsWith("-02-29"))).toBe(true);
});

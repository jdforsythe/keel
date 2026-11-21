// Seed 1337
import { gen } from "@keel/schema/gen";
import { Locale } from "@keel/std-i18n";
import fc from "fast-check";
import { expect, test } from "vitest";
import type { DateStyle } from "../src/DateStyle.ts";
import { Duration } from "../src/Duration.ts";
import { Instant } from "../src/Instant.ts";
import { PlainDate } from "../src/PlainDate.ts";
import { UnitStyle } from "../src/UnitStyle.ts";
import { addDays } from "../src/addDays.ts";
import { durationMs } from "../src/durationMs.ts";
import { durationOf } from "../src/durationOf.ts";
import { epochMs } from "../src/epochMs.ts";
import { formatDate } from "../src/formatDate.ts";
import { formatDuration } from "../src/formatDuration.ts";

const SEED = 1337;
const days = fc.integer({ min: -4_000_000, max: 4_000_000 });
// Day counts that keep the day and month and move the year by a century or a 400-year cycle.
const centuries = fc.constantFrom(36524, 36525, -36524, -36525, 146097, -146097);

test("addDays is additive: adding a then b equals adding a + b when every result is in range", () => {
  fc.assert(
    fc.property(gen(PlainDate), days, days, (d, a, b) => {
      const ab = addDays(d, a + b);
      const first = addDays(d, a);
      fc.pre(ab.ok && first.ok);
      if (!first.ok) return;
      expect(addDays(first.value, b)).toEqual(ab);
    }),
    { seed: SEED, numRuns: 300 },
  );
});

test("addDays by 0 is the identity, and a positive count gives a later date in string order", () => {
  fc.assert(
    fc.property(gen(PlainDate), fc.integer({ min: 1, max: 4_000_000 }), (d, n) => {
      expect(addDays(d, 0)).toEqual({ ok: true, value: d });
      const later = addDays(d, n);
      if (later.ok) expect(later.value > d).toBe(true);
    }),
    { seed: SEED, numRuns: 300 },
  );
});

test("Instant string order is time order", () => {
  fc.assert(
    fc.property(gen(Instant), gen(Instant), (i, j) => {
      expect(i < j).toBe(epochMs(i) < epochMs(j));
    }),
    { seed: SEED, numRuns: 300 },
  );
});

test("formatDate is injective per locale for the medium, long and full styles, also a century or 400 years apart", () => {
  // `short` writes two-digit years in many locales, so it is not injective across centuries.
  const styles = fc.constantFrom<DateStyle>("medium", "long", "full");
  fc.assert(
    fc.property(gen(PlainDate), fc.oneof(days, centuries), gen(Locale), styles, (d, n, locale, style) => {
      const other = addDays(d, n);
      fc.pre(other.ok && other.value !== d);
      if (other.ok) expect(formatDate(d, locale, style)).not.toBe(formatDate(other.value, locale, style));
    }),
    { seed: SEED, numRuns: 500 },
  );
});

test("formatDuration is injective per locale and unit style, also for durations a millisecond, a second or an hour apart", () => {
  const near = fc.constantFrom(1, -1, 1000, -1000, 3_600_000, -3_600_000);
  fc.assert(
    fc.property(gen(Duration), fc.oneof(gen(Duration), near), gen(Locale), gen(UnitStyle), (d, step, locale, style) => {
      const ms = typeof step === "number" ? durationMs(d) + step : durationMs(step);
      fc.pre(Math.abs(ms) <= 1e15 && ms !== durationMs(d));
      expect(formatDuration(d, locale, style)).not.toBe(formatDuration(durationOf(ms), locale, style));
    }),
    { seed: SEED, numRuns: 500 },
  );
});

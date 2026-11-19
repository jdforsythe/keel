// Spec: std.temporal, clause "With `process.env.TZ` set to `Pacific/Kiritimati` and then `America/Adak`, every export returns equal results for equal arguments."
// Seed 1337
import { gen } from "@keel/schema/gen";
import type { Locale } from "@keel/std-i18n";
import {
  type DateStyle,
  Duration,
  Instant,
  PlainDate,
  TimeZone,
  type UnitStyle,
  UTC,
  addDays,
  durationMs,
  durationOf,
  epochMs,
  formatDate,
  formatDuration,
  formatInstant,
  instantOf,
  plainDateOf,
} from "@keel/std-temporal";
import fc from "fast-check";
import { expect, test } from "vitest";

const LOCALES: readonly Locale[] = [
  "de-DE",
  "en-GB",
  "en-US",
  "es-ES",
  "fr-FR",
  "it-IT",
  "ja-JP",
  "ko-KR",
  "nl-NL",
  "pt-BR",
  "zh-CN",
];
const DATE_STYLES: readonly DateStyle[] = ["short", "medium", "long", "full"];
const UNIT_STYLES: readonly UnitStyle[] = ["long", "short", "narrow"];

function everyExport(x: {
  ms: number;
  frac: number;
  days: number;
  dms: number;
  i: Instant;
  d: PlainDate;
  zone: TimeZone;
  dur: Duration;
  locale: Locale;
  dateStyle: DateStyle;
  unitStyle: UnitStyle;
}): unknown {
  return [
    instantOf(x.ms),
    instantOf(x.frac),
    epochMs(x.i),
    plainDateOf(x.i, UTC),
    plainDateOf(x.i, x.zone),
    addDays(x.d, x.days),
    addDays(x.d, 0.5),
    durationOf(x.dms),
    durationMs(x.dur),
    formatDate(x.d, x.locale, x.dateStyle),
    formatInstant(x.i, x.locale, x.zone, x.dateStyle),
    formatDuration(x.dur, x.locale, x.unitStyle),
    Instant.parse(x.i),
    PlainDate.parse(x.d),
    TimeZone.parse(x.zone),
    Duration.parse(x.dur),
  ];
}

test("With `process.env.TZ` set to `Pacific/Kiritimati` and then `America/Adak`, every export returns equal results for equal arguments.", () => {
  const originalTZ = process.env.TZ;
  const inputs = fc.record({
    ms: fc.integer({ min: -62135596800000, max: 253402300799999 }),
    frac: fc.double({ noNaN: true, min: -1e15, max: 1e15 }),
    days: fc.integer({ min: -4_000_000, max: 4_000_000 }),
    dms: fc.integer({ min: -1e15, max: 1e15 }),
    i: gen(Instant),
    d: gen(PlainDate),
    zone: gen(TimeZone),
    dur: gen(Duration),
    locale: fc.constantFrom(...LOCALES),
    dateStyle: fc.constantFrom(...DATE_STYLES),
    unitStyle: fc.constantFrom(...UNIT_STYLES),
  });
  try {
    fc.assert(
      fc.property(inputs, (x) => {
        process.env.TZ = "Pacific/Kiritimati";
        const a = everyExport(x);
        process.env.TZ = "America/Adak";
        const b = everyExport(x);
        expect(b).toEqual(a);
      }),
      { seed: 1337, numRuns: 100 },
    );
  } finally {
    if (originalTZ === undefined) delete process.env.TZ;
    else process.env.TZ = originalTZ;
  }
});

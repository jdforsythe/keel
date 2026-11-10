// Spec: std.temporal, clause "For every `Locale`, style and generated value, `formatDate` and `formatInstant` equal the `Intl` expressions above. `formatDate('2026-11-10', l, 'long')` is `November 10, 2026`, `10. November 2026` and `2026年11月10日` for `en-US`, `de-DE` and `ja-JP`; `formatInstant('2026-11-10T23:30:00.000Z', 'de-DE', 'Asia/Tokyo', 'medium')` is `11.11.2026, 08:30:00`."
// Seed 1337
import { gen } from "@keel/schema/gen";
import type { Locale } from "@keel/std-i18n";
import { type DateStyle, Instant, PlainDate, TimeZone, formatDate, formatInstant } from "@keel/std-temporal";
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
const STYLES: readonly DateStyle[] = ["short", "medium", "long", "full"];

function must<T>(r: { ok: true; value: T } | { ok: false }): T {
  if (!r.ok) throw new Error("expected ok");
  return r.value;
}

test("For every `Locale`, style and generated value, `formatDate` and `formatInstant` equal the `Intl` expressions above. `formatDate('2026-11-10', l, 'long')` is `November 10, 2026`, `10. November 2026` and `2026年11月10日` for `en-US`, `de-DE` and `ja-JP`; `formatInstant('2026-11-10T23:30:00.000Z', 'de-DE', 'Asia/Tokyo', 'medium')` is `11.11.2026, 08:30:00`.", () => {
  fc.assert(
    fc.property(
      gen(PlainDate),
      gen(Instant),
      gen(TimeZone),
      fc.constantFrom(...LOCALES),
      fc.constantFrom(...STYLES),
      (d, i, zone, l, style) => {
        const dateExpected = new Intl.DateTimeFormat(l, { dateStyle: style, timeZone: "UTC" }).format(
          new Date(`${d}T00:00:00.000Z`),
        );
        expect(formatDate(d, l, style)).toBe(dateExpected);
        const instantExpected = new Intl.DateTimeFormat(l, {
          dateStyle: style,
          timeStyle: style,
          timeZone: zone,
        }).format(new Date(i));
        expect(formatInstant(i, l, zone, style)).toBe(instantExpected);
      },
    ),
    { seed: 1337, numRuns: 300 },
  );
  const d = must(PlainDate.parse("2026-11-10"));
  expect(formatDate(d, "en-US", "long")).toBe("November 10, 2026");
  expect(formatDate(d, "de-DE", "long")).toBe("10. November 2026");
  expect(formatDate(d, "ja-JP", "long")).toBe("2026年11月10日");
  const i = must(Instant.parse("2026-11-10T23:30:00.000Z"));
  const tokyo = must(TimeZone.parse("Asia/Tokyo"));
  expect(formatInstant(i, "de-DE", tokyo, "medium")).toBe("11.11.2026, 08:30:00");
});

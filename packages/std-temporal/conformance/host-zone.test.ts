// Spec: std.temporal, clause "With `Intl.DateTimeFormat` refusing `Europe/Kyiv`, `TimeZone.parse` accepts it; `plainDateOf` and `formatInstant` throw `RangeError`."
// Seed 1337 (no random input: the zone and instant are fixed).
// `Intl.DateTimeFormat` is replaced by a subclass that throws `RangeError` when constructed with `timeZone: 'Europe/Kyiv'` and builds the real formatter otherwise; the original is restored after each test.
import { Instant, TimeZone, UTC, formatInstant, plainDateOf } from "@keel/std-temporal";
import { afterEach, beforeEach, expect, test } from "vitest";

const RealDateTimeFormat = Intl.DateTimeFormat;

class RefusingKyiv extends RealDateTimeFormat {
  constructor(locales?: Intl.LocalesArgument, options?: Intl.DateTimeFormatOptions) {
    if (options?.timeZone === "Europe/Kyiv") throw new RangeError("Invalid time zone specified: Europe/Kyiv");
    super(locales, options);
  }
}

beforeEach(() => {
  Object.defineProperty(Intl, "DateTimeFormat", { value: RefusingKyiv, configurable: true, writable: true });
});
afterEach(() => {
  Object.defineProperty(Intl, "DateTimeFormat", { value: RealDateTimeFormat, configurable: true, writable: true });
});

const instantOk = Instant.parse("2026-11-10T23:30:00.000Z");
const kyiv = TimeZone.parse("Europe/Kyiv");

test("the stub refuses `Europe/Kyiv` and builds other zones normally", () => {
  expect(() => new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Kyiv" })).toThrow(RangeError);
  expect(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo" }).resolvedOptions().timeZone).toBe("Asia/Tokyo");
});

test("With `Intl.DateTimeFormat` refusing `Europe/Kyiv`, `TimeZone.parse` accepts it", () => {
  const r = TimeZone.parse("Europe/Kyiv");
  expect(r.ok).toBe(true);
  if (r.ok) expect(r.value).toBe("Europe/Kyiv");
});

test("With `Intl.DateTimeFormat` refusing `Europe/Kyiv`, `plainDateOf` throws `RangeError`", () => {
  expect(instantOk.ok && kyiv.ok).toBe(true);
  if (!(instantOk.ok && kyiv.ok)) return;
  expect(() => plainDateOf(instantOk.value, kyiv.value)).toThrow(RangeError);
  expect(plainDateOf(instantOk.value, UTC)).toBe("2026-11-10");
});

test("With `Intl.DateTimeFormat` refusing `Europe/Kyiv`, `formatInstant` throws `RangeError`", () => {
  expect(instantOk.ok && kyiv.ok).toBe(true);
  if (!(instantOk.ok && kyiv.ok)) return;
  expect(() => formatInstant(instantOk.value, "en-US", kyiv.value, "medium")).toThrow(RangeError);
  expect(formatInstant(instantOk.value, "en-US", UTC, "medium")).toBe("Nov 10, 2026, 11:30:00 PM");
});

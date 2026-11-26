// Spec: std.i18n, clause "`formatUnit(90, 'en-US', 'minute', 'long')` is `90 minutes`; `formatList(['1 hr', '5 min'], 'en-US', 'unit', 'short')` is `1 hr, 5 min`; `formatDateTime(0, 'en-US', { timeZone: 'UTC', month: '2-digit', day: '2-digit' })` is `01/01`, and `12/31` with `timeZone: 'America/New_York'`; `pluralCategories('en-US')` is `['one', 'other']` and `pluralCategories('ja-JP')` `['other']`."
// Seed 1337 (no random inputs)
import { formatDateTime, formatList, formatUnit, pluralCategories } from "@keel/std-i18n";
import { expect, test } from "vitest";

test("`formatUnit(90, 'en-US', 'minute', 'long')` is `90 minutes`", () => {
  expect(formatUnit(90, "en-US", "minute", "long")).toBe("90 minutes");
});

test("`formatList(['1 hr', '5 min'], 'en-US', 'unit', 'short')` is `1 hr, 5 min`", () => {
  expect(formatList(["1 hr", "5 min"], "en-US", "unit", "short")).toBe("1 hr, 5 min");
});

test("`formatDateTime(0, 'en-US', { timeZone: 'UTC', month: '2-digit', day: '2-digit' })` is `01/01`", () => {
  expect(formatDateTime(0, "en-US", { timeZone: "UTC", month: "2-digit", day: "2-digit" })).toBe("01/01");
});

test("`formatDateTime(0, 'en-US', ...)` is `12/31` with `timeZone: 'America/New_York'`", () => {
  expect(formatDateTime(0, "en-US", { timeZone: "America/New_York", month: "2-digit", day: "2-digit" })).toBe("12/31");
});

test("`pluralCategories('en-US')` is `['one', 'other']`", () => {
  expect(pluralCategories("en-US")).toEqual(["one", "other"]);
});

test("`pluralCategories('ja-JP')` is `['other']`", () => {
  expect(pluralCategories("ja-JP")).toEqual(["other"]);
});

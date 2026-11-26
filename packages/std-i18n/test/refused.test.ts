// std.i18n: an input a function refuses throws a RangeError whose message begins with the function's name, as
// std.temporal's durationOf does: a string that is no plain decimal, a time zone that is no string, and each input
// Intl refuses (a currency, a unit, a time, options).
import { expect, test } from "vitest";
import { formatDateTime } from "../src/formatDateTime.ts";
import { formatList } from "../src/formatList.ts";
import { formatUnit } from "../src/formatUnit.ts";
import { numberParts } from "../src/numberParts.ts";

/** The RangeError `run` throws, as `<name>: ...`; fails when it returns or throws anything else. */
const refused = (name: string, run: () => unknown): void => {
  let thrown: unknown;
  try {
    run();
  } catch (e) {
    thrown = e;
  }
  expect(thrown).toBeInstanceOf(RangeError);
  expect(thrown instanceof Error ? thrown.message.startsWith(`${name}: `) : false).toBe(true);
};
const joined = (n: number | `${number}`) =>
  numberParts(n, "en-US")
    .map((p) => p.value)
    .join("");

test("numberParts takes a plain decimal string and refuses every other string", () => {
  for (const d of ["0", "-0", "1800", "-0.05", "0.5", "123456789012345678901234567890"] as const)
    expect(joined(d), d).not.toBe("NaN");
  expect(joined("123456789012345678901234567890")).toBe("123,456,789,012,345,678,901,234,567,890");
  for (const s of ["1e400", "-1e-400", "0x10", "", " 1 ", "1_000", "Infinity", "NaN", ".5", "5.", "+1", "01", "-"])
    refused("numberParts", () => Reflect.apply(numberParts, undefined, [s, "en-US"]));
});

test("an invalid currency or unit, a time Date does not hold, and options Intl refuses throw a RangeError", () => {
  refused("numberParts", () => numberParts("1", "en-US", "US"));
  refused("formatUnit", () => formatUnit(1, "en-US", "furlong", "long"));
  refused("formatDateTime", () => formatDateTime(Number.NaN, "en-US", { timeZone: "UTC" }));
  refused("formatDateTime", () => formatDateTime(8.64e15 + 1, "en-US", { timeZone: "UTC" }));
  refused("formatDateTime", () => formatDateTime(0, "en-US", { timeZone: "Mars/Base" }));
  refused("formatDateTime", () => formatDateTime(0, "en-US", { timeZone: "UTC", dateStyle: "short", year: "numeric" }));
  refused("formatList", () => Reflect.apply(formatList, undefined, [["a"], "en-US", "conjunction", "wide"]));
});

test("formatDateTime refuses a missing time zone at run time, so the host's is never read", () => {
  const options: { timeZone?: string } = {};
  refused("formatDateTime", () => Reflect.apply(formatDateTime, undefined, [0, "en-US", options]));
  refused("formatDateTime", () => Reflect.apply(formatDateTime, undefined, [0, "en-US", { timeZone: "" }]));
  refused("formatDateTime", () => Reflect.apply(formatDateTime, undefined, [0, "en-US", undefined]));
  expect(formatDateTime(0, "en-US", { timeZone: "UTC", month: "2-digit", day: "2-digit" })).toBe("01/01");
});

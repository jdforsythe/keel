// std.schedules cron grammar: five fields, each `*`, `n`, `a-b`, a comma list, any with `/step`; names, macros, seconds
// and `L`, `W`, `#` are refused, naming the field. Seed 1337
import fc from "fast-check";
import { expect, test } from "vitest";
import { parseCron } from "../src/internal/parseCron.ts";

test("parses lists, ranges and steps to ascending values; a restricted day field is marked", () => {
  expect(parseCron("0,30 9-17/4 * 1,6 1-5")).toEqual({
    mi: [0, 30],
    h: [9, 13, 17],
    dom: Array.from({ length: 31 }, (_, i) => i + 1),
    mon: [1, 6],
    dow: [1, 2, 3, 4, 5],
    domR: false,
    dowR: true,
  });
  expect(parseCron("*/20 0 1 * *")).toMatchObject({ mi: [0, 20, 40], dom: [1], domR: true, dowR: false });
});

test("refuses what the grammar does not hold, naming the field", () => {
  const cases: [string, string][] = [
    ["60 * * * *", "minute"],
    ["* 24 * * *", "hour"],
    ["* * 0 * *", "day of month"],
    ["* * * 13 *", "month"],
    ["* * * * 7", "day of week"],
    ["0 0 * * MON", "day of week"],
    ["* * * JAN *", "month"],
    ["@daily", "minute"],
    ["* * * *", "day of week"],
    ["0 0 1 * * *", "extra field"],
    ["0 0 L * *", "day of month"],
    ["0 0 * * 1#2", "day of week"],
    ["5-1 * * * *", "minute"],
    ["*/0 * * * *", "minute"],
  ];
  for (const [cron, field] of cases) expect(parseCron(cron)).toContain(field);
});

test("every generated in-range field parses and its values stay in range", () => {
  fc.assert(
    fc.property(fc.integer({ min: 0, max: 59 }), fc.integer({ min: 1, max: 59 }), (a, step) => {
      const c = parseCron(`${a}/${step} * * * *`);
      expect(typeof c).toBe("object");
      if (typeof c !== "string") expect(c.mi.every((v) => v >= a && v <= 59 && (v - a) % step === 0)).toBe(true);
    }),
    { seed: 1337, numRuns: 100 },
  );
});

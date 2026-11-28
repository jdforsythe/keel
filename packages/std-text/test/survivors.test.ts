// Seed 1337
import { isDefect } from "@keel/schema";
import { gen } from "@keel/schema/gen";
import fc from "fast-check";
import { expect, test } from "vitest";
import { Email } from "../src/Email.schema.ts";
import { Slug } from "../src/Slug.schema.ts";
import { graphemes } from "../src/graphemes.ts";
import { line } from "../src/line.ts";
import { para } from "../src/para.ts";
import { textCheck } from "../src/textCheck.ts";
import { truncate } from "../src/truncate.ts";

const SEED = 1337;
const sample = <T>(arb: fc.Arbitrary<T>, n = 4000): T[] => fc.sample(arb, { seed: SEED, numRuns: n });

/** The `data` of the defect `run` raises, or `undefined` when it raises none. */
const defectData = (run: () => unknown): unknown => {
  try {
    run();
  } catch (e) {
    return isDefect(e) ? Reflect.get(e, "data") : undefined;
  }
  return undefined;
};

test("textCheck accepts equal bounds and raises a defect naming them for bounds outside 1..10000", () => {
  expect(textCheck(3, 3, false)("abc")).toBe(true);
  expect(textCheck(3, 3, false)("ab")).toBe(false);
  expect(textCheck(0, 10000, false)("")).toBe(true);
  expect(() => textCheck(0, 10001, false)).toThrow(
    "text bounds must be integers with 0 <= min <= max and 1 <= max <= 10000",
  );
  expect(defectData(() => textCheck(0, 10001, false))).toEqual({ min: "0", max: "10001" });
  expect(defectData(() => textCheck(4, 3, false))).toEqual({ min: "4", max: "3" });
  expect(defectData(() => textCheck(0, 0, false))).toEqual({ min: "0", max: "0" });
  expect(defectData(() => textCheck(-1, 3, false))).toEqual({ min: "-1", max: "3" });
  expect(defectData(() => textCheck(0.5, 3, false))).toEqual({ min: "0.5", max: "3" });
});

test("truncate raises a defect naming a max below 1", () => {
  expect(() => truncate("abc", 0)).toThrow("truncate: max must be an integer of at least 1");
  expect(defectData(() => truncate("abc", 0))).toEqual({ max: "0" });
  expect(defectData(() => truncate("abc", 1.5))).toEqual({ max: "1.5" });
});

test("para is named para(<min>..<max>), min defaulting to 1", () => {
  expect(para({ max: 9 }).doc()).toBe("para(1..9)");
  expect(para({ min: 2, max: 9 }).doc()).toBe("para(2..9)");
  expect(line({ min: 2, max: 9 }).doc()).toBe("line(2..9)");
});

test("para accepts a line break that line rejects", () => {
  expect(para({ max: 9 }).parse("a\nb").ok).toBe(true);
  expect(line({ max: 9 }).parse("a\nb").ok).toBe(false);
});

test("generated para values include line breaks and line values never do", () => {
  const p = sample(gen(para({ max: 40 })));
  expect(p.some((v) => v.includes("\n"))).toBe(true);
  const l = sample(gen(line({ max: 40 })));
  expect(l.some((v) => v.includes("\n"))).toBe(false);
  expect(l.some((v) => v.includes("~"))).toBe(true);
});

test("generated text is at least min graphemes, visible and padded with a", () => {
  const schema = line({ min: 6, max: 8 });
  const values = sample(gen(schema));
  for (const v of values) expect(graphemes(v)).toBeGreaterThanOrEqual(6);
  expect(values.some((v) => v.endsWith("aaaa") || v.includes("aaa"))).toBe(true);
  const short = sample(gen(line({ min: 0, max: 3 })));
  expect(short.some((v) => v === "")).toBe(true);
  expect(short.some((v) => v === "a")).toBe(true);
});

test("generated text keeps at most max graphemes of its source", () => {
  const values = sample(gen(line({ max: 2 })), 2000);
  expect(values.some((v) => graphemes(v) === 2)).toBe(true);
  for (const v of values) expect(graphemes(v)).toBeLessThanOrEqual(2);
});

test("generated emails use only address characters, with fallbacks for empty parts", () => {
  const values = sample(gen(Email));
  for (const v of values) {
    const [local = "", domain = ""] = v.split("@");
    expect(local).toMatch(/^[A-Za-z0-9_+-]+$/);
    expect(domain).toMatch(/^[A-Za-z0-9]+\.com$/);
  }
  expect(values.some((v) => v.startsWith("a@"))).toBe(true);
  expect(values.some((v) => v.endsWith("@example.com"))).toBe(true);
  expect(values.some((v) => /^[^@]*[+-][^@]*@/.test(v))).toBe(true);
  expect(values.some((v) => /^[^@]*_[^@]*@/.test(v))).toBe(true);
});

test("generated slugs are lowercase runs, with a for an empty source", () => {
  const values = sample(gen(Slug));
  expect(values).toContain("a");
  expect(values.some((v) => v.includes("-"))).toBe(true);
  expect(values.some((v) => /^[0-9]/.test(v))).toBe(true);
  expect(values.some((v) => /[a-z]/.test(v) && v !== "a")).toBe(true);
  for (const v of values) expect(v).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
});

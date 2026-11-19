// Seed 1337
import { gen } from "@keel/schema/gen";
import fc from "fast-check";
import { expect, test } from "vitest";
import { Email } from "../src/Email.ts";
import { Slug } from "../src/Slug.ts";
import { graphemes } from "../src/graphemes.ts";
import { line } from "../src/line.ts";
import { para } from "../src/para.ts";
import { textCheck } from "../src/textCheck.ts";
import { truncate } from "../src/truncate.ts";

const SEED = 1337;
const sample = <T>(arb: fc.Arbitrary<T>, n = 4000): T[] => fc.sample(arb, { seed: SEED, numRuns: n });

test("textCheck accepts equal bounds and rejects bounds outside 1..10000 with a message naming them", () => {
  expect(textCheck(3, 3, false)("abc")).toBe(true);
  expect(textCheck(3, 3, false)("ab")).toBe(false);
  expect(textCheck(0, 10000, false)("")).toBe(true);
  expect(() => textCheck(0, 10001, false)).toThrow(
    "text bounds must be integers with 0 <= min <= max and 1 <= max <= 10000, got 0..10001",
  );
  expect(() => textCheck(4, 3, false)).toThrow(RangeError);
  expect(() => textCheck(0, 0, false)).toThrow("got 0..0");
  expect(() => textCheck(-1, 3, false)).toThrow("got -1..3");
  expect(() => textCheck(0.5, 3, false)).toThrow("got 0.5..3");
});

test("truncate rejects a max below 1 with a message naming it", () => {
  expect(() => truncate("abc", 0)).toThrow("truncate: max must be an integer of at least 1, got 0");
  expect(() => truncate("abc", 1.5)).toThrow("got 1.5");
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

// Seed 1337 (no random inputs)
import { expect, test } from "vitest";
import { isEmail } from "../src/isEmail.ts";
import { isSlug } from "../src/isSlug.ts";
import { textCheck } from "../src/textCheck.ts";

const FAMILY = "👨‍👩‍👧";

test("the line check takes three families and refuses four, empty, LF, an override, BEL and non-NFC", () => {
  const line = textCheck(1, 3, false);
  expect(line(FAMILY.repeat(3))).toBe(true);
  expect(line(FAMILY.repeat(4))).toBe(false);
  const cp = (n: number): string => String.fromCharCode(n);
  for (const bad of [
    "",
    "a\nb",
    `a${cp(0x202e)}b`,
    "a\x07",
    `e${cp(0x301)}`,
    `a${cp(0x2028)}`,
    `a${cp(0x2066)}b`,
    "a\x85",
  ]) {
    expect(line(bad)).toBe(false);
  }
});

test("the para check takes LF and refuses CR", () => {
  const para = textCheck(1, 3, true);
  expect(para("a\nb")).toBe(true);
  expect(para("a\r\nb")).toBe(false);
});

test("text bounds outside 0 <= min <= max, 1 <= max <= 10000 or not integers throw", () => {
  for (const [min, max] of [
    [1, 0],
    [2, 1],
    [1, 1.5],
    [-1, 5],
    [0.5, 5],
    [1, 10001],
    [1, Number.NaN],
  ] as const) {
    expect(() => textCheck(min, max, false)).toThrow(RangeError);
  }
  expect(() => textCheck(0, 1, false)).not.toThrow();
  expect(() => textCheck(1, 10000, true)).not.toThrow();
});

test("isEmail takes the spec's address and refuses the spec's rejections", () => {
  const long = `${"a".repeat(64)}@${"a".repeat(63)}.${"a".repeat(63)}.${"a".repeat(58)}.com`;
  expect(isEmail("a.b+c@example.co")).toBe(true);
  expect(isEmail("A.B@Example.COM")).toBe(true);
  expect(isEmail(long.slice(1))).toBe(true);
  for (const bad of ["a@b", "a..b@example.com", "é@example.com", "@example.com", long, `${"a".repeat(65)}@x.co`]) {
    expect(isEmail(bad)).toBe(false);
  }
  for (const bad of [".a@x.co", "a.@x.co", "a@-x.co", "a@x-.co", "a@x.c0", "a@x..co", "a@x.co\n", "a b@x.co"]) {
    expect(isEmail(bad)).toBe(false);
  }
});

test("isSlug takes hyphen-separated runs of a-z and 0-9 up to 64 characters", () => {
  expect(isSlug("pasta-bake-2")).toBe(true);
  expect(isSlug("a".repeat(64))).toBe(true);
  for (const bad of ["Pasta", "-a", "a-", "a--b", "", "a".repeat(65), "a_b", "a\n"]) {
    expect(isSlug(bad)).toBe(false);
  }
});

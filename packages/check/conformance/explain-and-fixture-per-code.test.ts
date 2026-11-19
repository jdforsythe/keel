// Spec: k.check, clause "Every E code in a kernel section's Rules or in `reportedCodes()` has an `explain` entry of at
// most 120 tokens. Each one `check()` reports (`reportedCodes()`) has a fixture that triggers exactly that code
// (E1756: a registered rule that throws); each other Rules code comes from another command and a conformance test of
// its own package asserts it (outside comments and test titles)."
// Seed 1337 (no random inputs: codes are read from spec/kernel/*.md, `reportedCodes()` and packages/*/conformance).
// RFC 0065 replaces the explain-only list (RFC 0020, 0040) with `reportedCodes()`.
import { readFileSync, readdirSync } from "node:fs";
import { check, defineRule, reportedCodes } from "@keel/check";
import { explain } from "@keel/check/explain";
import { expect, test } from "vitest";
import { CODE_FIXTURES } from "./fixtures-by-code.ts";
import { specCodes } from "./spec-codes.ts";
import { approxTokens, sourceFilesUnder } from "./support.ts";

const THROWS = "throws.ts";
defineRule({
  code: "E2956",
  message: "throws on one path",
  see: "k.check",
  explain: "A rule that throws on throws.ts, for the E1756 fixture.",
  check: ({ file }) => {
    if (file.path === THROWS) throw new Error("boom");
    return [];
  },
});

const isE = (c: string): boolean => /^E\d{4}$/.test(c);
const isKernel = (c: string): boolean => /^E1\d{3}$/.test(c);
const REPORTED: readonly string[] = reportedCodes();
const SPEC: readonly string[] = specCodes();
const ALL: readonly string[] = [...new Set([...SPEC, ...REPORTED.filter(isE)])].sort();
const codesOf = (files: Parameters<typeof check>[0], opts?: Parameters<typeof check>[1]): string[] =>
  [...new Set(check(files, opts).diagnostics.map((d) => d.code))].sort();

/** Lines that assert something: an `expect`, a throw matcher, an equality matcher, or a `code:` field. */
const ASSERTION = /expect\(|toThrow\(|toEqual\(|toMatchObject\(|toContain\(|toBe\(|toMatch\(|code:|\.code\s*===/;
/** A test or suite title (`it("E1902 …"`), which names a code without asserting it. */
const TITLE = /\b(?:it|test|describe)(?:\.\w+)*\(\s*(["'`])(?:\\.|(?!\1).)*\1/g;
/** Assertion lines of a source with comments and titles removed (rfc:0065, backlog 0186). */
const assertions = (src: string): string[] =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !l.trim().startsWith("//"))
    .map((l) => l.replace(TITLE, ""))
    .filter((l) => ASSERTION.test(l));

/** Assertion lines of every package's conformance but @keel/check, read once. */
const PACKAGES = new URL("../../", import.meta.url);
const OTHER_ASSERTIONS: readonly string[] = readdirSync(PACKAGES)
  .filter((p) => p !== "check")
  .flatMap((p) => {
    const dir = new URL(`${p}/conformance/`, PACKAGES);
    return sourceFilesUnder(dir).flatMap((n) => assertions(readFileSync(new URL(n, dir), "utf8")));
  });

test("reportedCodes() is sorted and unique, and lists every code a fixture triggers", () => {
  expect([...new Set(REPORTED)].sort()).toEqual(REPORTED);
  expect(Object.keys(CODE_FIXTURES).filter((c) => !REPORTED.includes(c))).toEqual([]);
});

test("every kernel E code check() reports has a fixture (E1756 has a throwing rule instead)", () => {
  const kernel = REPORTED.filter(isKernel);
  expect(kernel.length).toBeGreaterThan(45);
  expect(kernel.filter((c) => c !== "E1756" && !Object.hasOwn(CODE_FIXTURES, c))).toEqual([]);
});

test("E1756: a registered rule that throws on the fixture triggers exactly E1756; another file does not", () => {
  expect(codesOf([{ path: THROWS, source: "export const throws = 1\n" }])).toEqual(["E1756"]);
  expect(codesOf([{ path: "a.ts", source: "export const a = 1\n" }])).not.toContain("E1756");
});

test("every Rules code check() does not report is asserted by another package's conformance", () => {
  const other = SPEC.filter((c) => !REPORTED.includes(c));
  expect(other.length).toBeGreaterThan(30);
  expect(other.filter((c) => !OTHER_ASSERTIONS.some((line) => line.includes(c)))).toEqual([]);
});

test("a code only in a comment or a test title is not an assertion", () => {
  const src = '// E9999 in a header\n/* E9998 */\nit("E9997 title", () => {\n  expect(f()).toBe(1);\n});\n';
  expect(assertions(src).join("\n")).not.toMatch(/E999[789]/);
  expect(assertions("  expect(() => f()).toThrow(/^E9996 /);\n")).toHaveLength(1);
});

for (const code of ALL) {
  test(`${code}: explain is at most 120 tokens and names the code`, () => {
    const text = explain(code);
    expect(text).toContain(code);
    expect(approxTokens(text)).toBeLessThanOrEqual(120);
  });
}

for (const [code, fx] of Object.entries(CODE_FIXTURES)) {
  test(`${code}: its fixture triggers exactly that code`, () => {
    expect(codesOf(fx.bad, fx.badOpts ?? fx.opts)).toEqual([code]);
  });
}

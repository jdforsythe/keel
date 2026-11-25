// Spec: k.ui, clause "`<Box gap=\"2\">` with no `direction` is E1809 and its fix adds `direction=\"column\"`; with `direction={{ base: 'column', md: 'row' }}`, or a look that sets `direction`, it is clean and is a row at 1024px; `gap={{ base: '2' }}` with `direction={{ md: 'row' }}` is E1809."
// k.ui, Rules "E1809 `gap` with no `direction` (fix: `direction="column"`)"
// Seed: 1337 (property over gap tokens and direction values).
// Not built yet: every case is `test.skip`; the builder changes `test.skip` to `test` in each. Owed after the build, for a conformance writer (they would turn live suites red before it):
// the E1809 entry in fixtures-by-code.ts, and "E1809" in the `FIX` list with a Bad entry in fix-diffs.test.ts (the spec gives it a fix; it is not a `NO_FIX` code).
// Assumed: the fix is a unified diff applied with `git apply` (as E1820's); a look or a `base` set read from the tokens artifact (`artifacts: { tokens }`) with `gap` and no `direction` is E1809 too (k.ui: "on an element, a look or a `base` set").
// "Is a row at 1024px" is Chromium's and is not testable here; that `direction` is accepted at `md` and the case is clean is what is asserted.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { check } from "@keel/check";
import * as fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED, one } from "./support.ts";

const HEAD = "import { Box, Text } from '@keel/ui'\n";
const page = (attrs: string, pre = ""): string =>
  `${HEAD}${pre}export default function C() { return <Box ${attrs}><Text>a</Text><Text>b</Text></Box> }\n`;
const TOKENS = { space: { 1: "4px", 2: "8px" }, breakpoint: { md: "768px" } };
const e1809 = (source: string, tokens?: object) =>
  check(one(source), { types: false, ...(tokens === undefined ? {} : { artifacts: { tokens } }) }).diagnostics.filter(
    (d) => d.code === "E1809",
  );

describe("k.ui: E1809 gap with no direction", () => {
  test('`<Box gap="2">` with no `direction` is E1809', () => {
    expect(e1809(page('gap="2"'))).toHaveLength(1);
  });

  test('its fix adds `direction="column"`', () => {
    const source = page('gap="2"');
    const fix = e1809(source)[0]?.fix;
    expect(typeof fix).toBe("string");
    const dir = mkdtempSync(join(tmpdir(), "keel-e1809-"));
    try {
      writeFileSync(join(dir, "C.tsx"), source);
      writeFileSync(join(dir, "fix.patch"), `${fix ?? ""}\n`);
      execFileSync("git", ["apply", "--unsafe-paths", "--directory=.", "fix.patch"], { cwd: dir });
      const patched = readFileSync(join(dir, "C.tsx"), "utf8");
      expect(patched).toContain('direction="column"');
      expect(patched).toContain('gap="2"');
      expect(e1809(patched)).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("with `direction={{ base: 'column', md: 'row' }}` it is clean", () => {
    expect(e1809(page(`gap="2" direction={{ base: 'column', md: 'row' }}`))).toEqual([]);
  });

  test("`gap={{ base: '2' }}` with `direction={{ md: 'row' }}` is E1809: direction is not set at the smallest breakpoint", () => {
    expect(e1809(page(`gap={{ base: '2' }} direction={{ md: 'row' }}`))).toHaveLength(1);
  });

  test("a computed `direction` counts", () => {
    const src = `${HEAD}export default function C(props: { dir: 'row' | 'column' }) { return <Box gap="2" direction={props.dir}><Text>a</Text></Box> }\n`;
    expect(e1809(src)).toEqual([]);
  });

  test("a look that sets `direction` makes `gap` clean", () => {
    const tokens = { ...TOKENS, look: { stack: { direction: "column" } } };
    expect(e1809(page('look="stack" gap="2"'), tokens)).toEqual([]);
  });

  test("a look with `gap` and no `direction` is E1809", () => {
    const tokens = { ...TOKENS, look: { stack: { gap: "2" } } };
    expect(e1809(page('look="stack"'), tokens).length).toBeGreaterThan(0);
  });

  test("a `base` set with `gap` and no `direction` is E1809, and clean with one", () => {
    const bad = { ...TOKENS, base: { page: { gap: "2" } } };
    const clean = { ...TOKENS, base: { page: { gap: "2", direction: "column" } } };
    expect(e1809(page(""), bad).length).toBeGreaterThan(0);
    expect(e1809(page(""), clean)).toEqual([]);
  });

  test("any gap token is E1809 without a `direction` and clean with any `direction` at base (property)", () => {
    fc.assert(
      fc.property(fc.constantFrom("1", "2"), fc.constantFrom("row", "column", "row-reverse"), (gap, direction) => {
        expect(e1809(page(`gap="${gap}"`))).toHaveLength(1);
        const diags = check(one(page(`gap="${gap}" direction="${direction}"`)), { types: false }).diagnostics;
        expect(diags.filter((d) => d.code === "E1809")).toEqual([]);
      }),
      { seed: SEED, numRuns: 12 },
    );
  });

  test("a `direction` with no `gap`, and neither prop, are clean", () => {
    expect(e1809(page('direction="row"'))).toEqual([]);
    expect(e1809(page(""))).toEqual([]);
  });
});

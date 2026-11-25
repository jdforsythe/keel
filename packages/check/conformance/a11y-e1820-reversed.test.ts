// Spec: k.a11y, clause "A `Box` with `direction=\"row-reverse\"` over two `Button`s is E1820 and its fix leaves `direction=\"row\"` with the children reversed; over one `Button` it is clean."
// Seed: 1337.
// Assumed: the fix is a unified diff applied with `git apply` (as fix-applies.test.ts); `direction` token names `row`, `row-reverse`, `column`, `column-reverse` are written as string props.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { check } from "@keel/check";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, one } from "./support.ts";

const HEAD = "import { Box, Button, Text } from '@keel/ui'\n";
const src = (dir: string, kids: string): string =>
  `${HEAD}export default function C() { return <Box direction="${dir}">${kids}</Box> }\n`;
const A = "<Button onClick={() => {}}>A</Button>";
const B = "<Button onClick={() => {}}>B</Button>";
const e1820 = (source: string) => check(one(source), { types: false }).diagnostics.filter((d) => d.code === "E1820");

describe("k.a11y: E1820 reversed direction over focusable elements", () => {
  it('A `Box` with `direction="row-reverse"` over two `Button`s is E1820', () => {
    expect(e1820(src("row-reverse", `${A}${B}`))).toHaveLength(1);
  });

  it("column-reverse over two focusable base elements is E1820 too", () => {
    expect(e1820(src("column-reverse", `${A}${B}`))).toHaveLength(1);
  });

  it('its fix leaves `direction="row"` with the children reversed', () => {
    const source = src("row-reverse", `${A}${B}`);
    const fix = e1820(source)[0]?.fix;
    expect(typeof fix).toBe("string");
    const dir = mkdtempSync(join(tmpdir(), "keel-e1820-"));
    try {
      writeFileSync(join(dir, "C.tsx"), source);
      writeFileSync(join(dir, "fix.patch"), `${fix ?? ""}\n`);
      execFileSync("git", ["apply", "--unsafe-paths", "--directory=.", "fix.patch"], { cwd: dir });
      const patched = readFileSync(join(dir, "C.tsx"), "utf8");
      expect(patched).toContain('direction="row"');
      expect(patched).not.toContain("row-reverse");
      expect(patched.indexOf(">B<")).toBeLessThan(patched.indexOf(">A<"));
      expect(e1820(patched)).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("over one `Button` it is clean", () => {
    expect(e1820(src("row-reverse", A))).toEqual([]);
  });

  it("over non-focusable children it is clean", () => {
    expect(e1820(src("row-reverse", "<Text>a</Text><Text>b</Text>"))).toEqual([]);
  });

  it("plain `row` and `column` over two Buttons are clean", () => {
    for (const dir of ["row", "column"]) expect(e1820(src(dir, `${A}${B}`))).toEqual([]);
  });

  it("any reversed direction over n focusable children is E1820 exactly when n >= 2 (property)", () => {
    fc.assert(
      fc.property(fc.constantFrom("row-reverse", "column-reverse"), fc.integer({ min: 0, max: 5 }), (dir, n) => {
        const kids = Array.from({ length: n }, () => A).join("");
        expect(e1820(src(dir, kids)).length).toBe(n >= 2 ? 1 : 0);
      }),
      { seed: SEED, numRuns: 30 },
    );
  });
});

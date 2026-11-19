// Seed 1337
// Conformance: applying the fix diff to its fixture with `git apply` succeeds and re-checking reports no diagnostic of that code.
// Sampled over the fix-bearing codes below, not the full top 30.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { check } from "@keel/check";
import { expect, test } from "vitest";
import { one } from "./support.ts";

const CASES: { code: string; source: string }[] = [
  {
    code: "E1401",
    source: `import { Text } from '@keel/ui'\nexport default function C({ name }) { return <Text>{name}</Text> }\n`,
  },
  { code: "E1805", source: `export default function C() { return <div>hi</div> }\n` },
  {
    code: "E1808",
    source: `import { Box, Text } from '@keel/ui'\nexport default function C() { return Box({ children: Text({ children: "x" }) }) }\n`,
  },
  { code: "E1601", source: `export const stamp = () => Date.now()\n` },
  { code: "E1451", source: `export function f() { throw new Error("x") }\n` },
  { code: "E1452", source: `export function f() { try { return 1 } catch (e) { return 2 } }\n` },
];

for (const c of CASES) {
  test(`${c.code}: applying the fix diff with git apply succeeds and re-checking reports no ${c.code}`, () => {
    const dir = mkdtempSync(join(tmpdir(), "keel-fix-"));
    try {
      const diags = check(one(c.source), {}).diagnostics.filter((d) => d.code === c.code);
      expect(diags.length).toBeGreaterThan(0);
      const fix = diags[0]?.fix;
      expect(typeof fix).toBe("string");
      writeFileSync(join(dir, "C.tsx"), c.source);
      writeFileSync(join(dir, "fix.patch"), `${fix ?? ""}\n`);
      execFileSync("git", ["apply", "--unsafe-paths", "--directory=.", "fix.patch"], { cwd: dir });
      const patched = readFileSync(join(dir, "C.tsx"), "utf8");
      expect(patched).not.toBe(c.source);
      const again = check(one(patched), {}).diagnostics.map((d) => d.code);
      expect(again).not.toContain(c.code);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}

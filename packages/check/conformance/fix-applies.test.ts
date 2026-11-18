// Seed 1337
// Conformance: applying the fix diff to its fixture with `git apply` succeeds and re-checking reports no diagnostic of that code.
// Sampled over the fix-bearing codes below, not the full top 30.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { check } from "@keel/check";
import { expect, test } from "vitest";
import { one } from "./support.ts";

const CASES: { code: string; source: string; path?: string; more?: { path: string; source: string }[] }[] = [
  {
    code: "E1401",
    source: `import { Text } from '@keel/ui'\nexport default function C({ name }) { return <Text>{name}</Text> }\n`,
  },
  { code: "E1805", source: "export default function C() { return <div>hi</div> }\n" },
  {
    code: "E1808",
    source: `import { Box, Text } from '@keel/ui'\nexport default function C() { return Box({ children: Text({ children: "x" }) }) }\n`,
  },
  {
    code: "E1258",
    source: `import { Box } from '@keel/ui'\nexport function Card(props: { icon?: unknown }) { return <Box>{props.icon}</Box> }\nexport function Icon() { return <Box>i</Box> }\nexport function Page() { return Card({ icon: Icon() }) }\n`,
  },
  {
    code: "E1406",
    source: `import { Box } from '@keel/ui'\nexport default function C(props: { icon: () => Node }) { return <Box>{props.icon}</Box> }\n`,
  },
  {
    code: "E1759",
    path: "modules/shop/paths.server.ts",
    source: "export const paths = __dirname\n",
    more: [
      {
        path: "topology.ts",
        source: `import { topology } from '@keel/server'\nexport default topology({ web: { modules: ['shop'], adapter: 'node' } })\n`,
      },
      {
        path: "modules/shop/module.ts",
        source: `import { module } from '@keel/compiler'\nexport default module({ id: 'shop', deps: [], capabilities: [], public: { exports: [], routes: [] } })\n`,
      },
    ],
  },
  { code: "E1601", source: "export const stamp = () => Date.now()\n" },
  { code: "E1451", source: `export function f() { throw new Error("x") }\n` },
  { code: "E1452", source: "export function f() { try { return 1 } catch (e) { return 2 } }\n" },
];

for (const c of CASES) {
  test(`${c.code}: applying the fix diff with git apply succeeds and re-checking reports no ${c.code}`, () => {
    const dir = mkdtempSync(join(tmpdir(), "keel-fix-"));
    try {
      const path = c.path ?? "C.tsx";
      const files = [{ path, source: c.source }, ...(c.more ?? [])];
      const diags = check(c.more === undefined ? one(c.source) : files, {}).diagnostics.filter(
        (d) => d.code === c.code,
      );
      expect(diags.length).toBeGreaterThan(0);
      const fix = diags[0]?.fix;
      expect(typeof fix).toBe("string");
      for (const f of files) {
        mkdirSync(dirname(join(dir, f.path)), { recursive: true });
        writeFileSync(join(dir, f.path), f.source);
      }
      writeFileSync(join(dir, "fix.patch"), `${fix ?? ""}\n`);
      execFileSync("git", ["apply", "--unsafe-paths", "--directory=.", "fix.patch"], { cwd: dir });
      const patched = readFileSync(join(dir, path), "utf8");
      expect(patched).not.toBe(c.source);
      const again = check(
        c.more === undefined ? one(patched) : [{ path, source: patched }, ...(c.more ?? [])],
        {},
      ).diagnostics.map((d) => d.code);
      expect(again).not.toContain(c.code);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}

// E1401 fixes are unified patches that `git apply` accepts (k.check applies fixes). Temp dirs live in test/.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { compile } from "@keel/compiler";
import { tempDir } from "@keel/tooling/test-tmp";
import { describe, expect, it } from "vitest";

function apply(file: string, source: string, fix: string): string {
  const dir = tempDir(".tmp-apply-", import.meta.dirname);
  try {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), source);
    fs.writeFileSync(path.join(dir, "fix.patch"), `${fix}\n`);
    const env = { ...process.env, GIT_CEILING_DIRECTORIES: path.dirname(dir) };
    execFileSync("git", ["apply", "--check", "fix.patch"], { cwd: dir, env, stdio: "pipe" });
    execFileSync("git", ["apply", "fix.patch"], { cwd: dir, env, stdio: "pipe" });
    return fs.readFileSync(path.join(dir, file), "utf8");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const cases: { name: string; file: string; source: string; expected: string }[] = [
  {
    name: "single line, no final newline",
    file: "C.tsx",
    source: "export default function C({ name }) { return <p>{name}</p> }",
    expected: "export default function C(props) { return <p>{props.name}</p> }",
  },
  {
    name: "multi-line with separate hunks and a final newline",
    file: "src/ui/Card.tsx",
    source: [
      "import { s } from '@keel/schema'",
      "export const Props = s.object({ title: s.string(), n: s.number() })",
      "export default function Card({ title, n }: { title: string; n: number }) {",
      "  const a = 1",
      "  const b = 2",
      "  const c = 3",
      "  const d = 4",
      "  const e = 5",
      "  const f = 6",
      "  const g = 7",
      "  const h = 8",
      "  return <section>",
      "    <h1>{title}</h1>",
      "    <p>{n + a + b + c + d + e + f + g + h}</p>",
      "  </section>",
      "}",
      "",
    ].join("\n"),
    expected: "",
  },
];

describe("E1401 fix patches", () => {
  for (const c of cases) {
    it(`git apply accepts the fix (${c.name}) and produces the rewritten source`, () => {
      const d = compile([{ path: c.file, source: c.source }]).diagnostics.filter((x) => x.code === "E1401");
      expect(d.length).toBe(1);
      const fix = d[0]?.fix ?? "";
      expect(fix.startsWith(`--- a/${c.file}\n+++ b/${c.file}\n@@ -`)).toBe(true);
      const out = apply(c.file, c.source, fix);
      const expected =
        c.expected !== ""
          ? c.expected
          : c.source
              .replace("Card({ title, n }:", "Card(props:")
              .replace("{title}", "{props.title}")
              .replace("{n + a", "{props.n + a");
      expect(out).toBe(expected);
    });
  }

  it("emits one hunk per distant edit", () => {
    const fix = compile([{ path: cases[1]?.file ?? "", source: cases[1]?.source ?? "" }]).diagnostics[0]?.fix ?? "";
    expect(fix.split("\n").filter((l) => l.startsWith("@@")).length).toBe(2);
  });
});

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  blocksOf,
  checkCodes,
  checkCopy,
  checkFragments,
  checkRepo,
  checkRepoOnly,
  checkSections,
  checkShape,
  checkTemplateCodes,
  checkTemplateRepoOnly,
  checkTemplateSections,
  checkTemplateSize,
  fences,
  knownCodes,
  sectionIds,
  templates,
  typeCheck,
  writeCopies,
} from "../docs-check.mjs";
import { fixedTime } from "../test-time.ts";

const repo = path.join(import.meta.dirname, "..", "..");
const codes = (diags: { code: string }[]) => diags.map((d) => d.code);
const fm = (extra = "") => `---\nname: keel\ndescription: "x; E1001"\n---\n${extra}`;

const scratch: string[] = [];
afterEach(() => {
  for (const d of scratch.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});
const tmp = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "docs-check-test-"));
  scratch.push(d);
  return d;
};

describe("fences", () => {
  it("reads the tag, the fragment flag and the first code line", () => {
    const f = fences("a\n```ts fragment\nconst x = 1\n```\n```bash\nls\n```\n");
    expect(f.map((b) => [b.lang, b.fragment, b.line])).toEqual([
      ["ts", true, 3],
      ["bash", false, 6],
    ]);
  });
});

describe("D0006 D0008 D0014: type-checking", () => {
  const ok = "```ts\nimport { s } from '@keel/schema'\nexport const A = s.object({ id: s.string() })\n```\n";
  it("passes a block that compiles", () => {
    expect(typeCheck(repo, [{ name: "keel", text: ok }])).toEqual([]);
  });
  it("fails a block with a type error, at the line in the skill", () => {
    const text = "intro\n```ts\nimport { s } from '@keel/schema'\nconst x: number = s.string()\n```\n";
    const d = typeCheck(repo, [{ name: "keel", text }]);
    expect(d.map((x) => [x.code, x.line])).toEqual([["D0006", 4]]);
  });
  it("skips a block tagged fragment", () => {
    const text = "```ts fragment\nconst x: number = 'a'\n```\n";
    expect(typeCheck(repo, [{ name: "keel", text }])).toEqual([]);
  });
  it("fails an import of an export the package lacks, in a fence or a code span", () => {
    const fence = "```ts\nimport { nope } from '@keel/schema'\nvoid nope\n```\n";
    const span = "Use `import { nope } from '@keel/schema'` here.\n";
    expect(codes(typeCheck(repo, [{ name: "keel", text: fence }]))).toEqual(["D0008"]);
    expect(codes(typeCheck(repo, [{ name: "keel", text: span }]))).toEqual(["D0008"]);
  });
  it("accepts a code span importing a real export", () => {
    expect(typeCheck(repo, [{ name: "keel", text: "`import { s } from '@keel/schema'`\n" }])).toEqual([]);
  });
  it("lets a block import another of the skill that exports the names", () => {
    const a = "```ts\nexport const one = 1\n```\n";
    const b = "```ts\nimport { one } from './anything.ts'\nexport const two: number = one\n```\n";
    expect(typeCheck(repo, [{ name: "keel", text: a + b }])).toEqual([]);
  });
  it("reports D0014 when no block provides the import", () => {
    const b = "```ts\nimport { one } from './anything.ts'\nvoid one\n```\n";
    expect(codes(blocksOf("keel", b).diags)).toEqual(["D0014"]);
    expect(codes(typeCheck(repo, [{ name: "keel", text: b }]))).toContain("D0014");
  });
  it("leaves no temporary folder behind", () => {
    const before = fs.readdirSync(os.tmpdir()).filter((n) => n.startsWith("docs-check-") && !n.includes("test"));
    typeCheck(repo, [{ name: "keel", text: ok }]);
    const after = fs.readdirSync(os.tmpdir()).filter((n) => n.startsWith("docs-check-") && !n.includes("test"));
    expect(after).toEqual(before);
  });
});

describe("D0007: fragments", () => {
  const frag = "```ts fragment\nx\n```\n";
  it("allows two and fails three", () => {
    expect(checkFragments("keel", frag + frag)).toEqual([]);
    expect(codes(checkFragments("keel", frag + frag + frag))).toEqual(["D0007"]);
  });
});

describe("D0009: codes", () => {
  const known = new Set(["E1001", "E1901", "E1651"]);
  it("passes known codes and a range holding one", () => {
    expect(checkCodes("keel", "E1001 and E19xx and E165x", known)).toEqual([]);
  });
  it("fails an unknown code and an empty range", () => {
    expect(codes(checkCodes("keel", "E9999", known))).toEqual(["D0009"]);
    expect(codes(checkCodes("keel", "E77xx", known))).toEqual(["D0009"]);
  });
  it("reads the catalog and the spec of the repo", () => {
    const k = knownCodes(repo);
    expect(k.has("E1001")).toBe(true);
    expect(k.has("E9998")).toBe(false);
  });
});

describe("D0010: section ids", () => {
  const ids = new Set(["k.router", "std.db"]);
  it("passes ids that are spec files, with a trailing period", () => {
    expect(checkSections("keel", "`keel docs k.router`, std.db.", ids)).toEqual([]);
  });
  it("fails an id with no file", () => {
    expect(codes(checkSections("keel", "keel docs k.nowhere", ids))).toEqual(["D0010"]);
  });
  it("finds the std sections that the map table lacks", () => {
    expect(sectionIds(repo).has("std.outbox-owner")).toBe(true);
  });
});

describe("D0011: repo-only names", () => {
  it("passes keel docs, package-internal docs paths and URLs", () => {
    const text = "keel docs k.router; node_modules/@keel/x/docs/y.md; https://a.dev/docs/b; ../modules/x";
    expect(checkRepoOnly("keel", text)).toEqual([]);
  });
  it.each([
    "pnpm spec k.x",
    "see spec/kernel",
    "(docs/OUTPUT.md)",
    "`apps/golden-1`",
    "packages/cli",
    ".claude/skills",
    "--workspace",
  ])("fails %s", (text) => {
    expect(codes(checkRepoOnly("keel", text))).toEqual(["D0011"]);
  });
});

describe("D0012: shape", () => {
  it("passes a small skill with frontmatter", () => {
    expect(checkShape("keel", fm("body"), 900)).toEqual([]);
  });
  it("fails a skill over the target", () => {
    expect(codes(checkShape("keel", fm("x".repeat(400)), 50))).toEqual(["D0012"]);
  });
  it("fails missing description and a wrong name", () => {
    expect(codes(checkShape("keel", "---\nname: keel\n---\n", 900))).toEqual(["D0012"]);
    expect(codes(checkShape("keel", "---\nname: other\ndescription: d\n---\n", 900))).toEqual(["D0012"]);
    expect(codes(checkShape("keel", "no frontmatter", 900))).toEqual(["D0012", "D0012"]);
  });
});

describe("D0013: copies", () => {
  const make = () => {
    const d = tmp();
    fs.mkdirSync(path.join(d, "packages/cli/skills/keel"), { recursive: true });
    fs.writeFileSync(path.join(d, "packages/cli/skills/keel/SKILL.md"), "one\n");
    return d;
  };
  it("writeCopies makes the copy equal", () => {
    const d = make();
    expect(codes(checkCopy(d, "keel"))).toEqual(["D0013"]);
    writeCopies(d, ["keel"]);
    expect(checkCopy(d, "keel")).toEqual([]);
  });
  it("fails a changed file and an extra file", () => {
    const d = make();
    writeCopies(d, ["keel"]);
    fs.writeFileSync(path.join(d, ".claude/skills/keel/SKILL.md"), "two\n");
    fs.writeFileSync(path.join(d, ".claude/skills/keel/extra.md"), "x\n");
    expect(codes(checkCopy(d, "keel"))).toEqual(["D0013", "D0013"]);
  });
});

describe("D0015 D0016 D0017 D0018: the scaffold templates", () => {
  const agents = (text: string) => ({
    file: "AGENTS.md",
    source: "packages/scaffold/src/templates/agentsBlock.ts",
    text,
  });
  it("renders AGENTS.md (the Keel block, each skill's copy path) and CLAUDE.md", () => {
    const t = templates([{ name: "keel", text: fm("body\n") }]);
    expect(t.map((x: { file: string }) => x.file)).toEqual(["AGENTS.md", "CLAUDE.md"]);
    expect(t[0]?.text).toContain(".claude/skills/keel/SKILL.md");
    expect(t[1]?.text).toBe("@AGENTS.md");
  });
  it("D0015 passes known codes and a range holding one, fails an unknown code and an empty range", () => {
    const known = new Set(["E1001", "E1901"]);
    expect(checkTemplateCodes(repo, agents("E1001, E19xx"), known)).toEqual([]);
    expect(codes(checkTemplateCodes(repo, agents("E9999 and E77xx"), known))).toEqual(["D0015", "D0015"]);
  });
  it("D0016 passes a section id with a spec file, fails one without", () => {
    const ids = new Set(["k.router"]);
    expect(checkTemplateSections(repo, agents("`keel docs k.router`"), ids)).toEqual([]);
    expect(codes(checkTemplateSections(repo, agents("keel docs k.nowhere"), ids))).toEqual(["D0016"]);
  });
  it("D0017 allows .claude/skills/ and keel docs, nothing else repo-only", () => {
    expect(checkTemplateRepoOnly(repo, agents("`.claude/skills/keel/SKILL.md`; keel docs k.router"))).toEqual([]);
  });
  it.each([
    "pnpm spec k.x",
    "spec/kernel",
    "docs/OUTPUT.md",
    "apps/golden-1",
    "packages/cli",
    ".claude/agents",
    "--workspace",
  ])("D0017 fails %s", (text) => {
    expect(codes(checkTemplateRepoOnly(repo, agents(text)))).toEqual(["D0017"]);
  });
  it("D0018 passes a block within docs.agents, fails one over it, at the template's source file", () => {
    expect(checkTemplateSize(repo, agents("x".repeat(40)), 10)).toEqual([]);
    const over = checkTemplateSize(repo, agents("x".repeat(41)), 10);
    expect(codes(over)).toEqual(["D0018"]);
    expect(over[0]?.path).toBe("packages/scaffold/src/templates/agentsBlock.ts");
  });
});

describe("the published skills", () => {
  // Reads every skill, agent template and doc the repository publishes: about 0.6 s here, so 15 s.
  it("pass every check", { timeout: fixedTime(15_000) }, () => {
    expect(checkRepo(repo).diags).toEqual([]);
  });
});

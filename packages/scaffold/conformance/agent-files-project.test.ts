// Spec: k.scaffold, clause "`scaffold project` writes a <= 600-token block naming `keel docs`, `keel explain`, skill paths, without `pnpm spec`, `spec/` or `--workspace`; `CLAUDE.md` `@AGENTS.md\n`; copies equal to `keel docs <name>`; with `--workspace`, none."
// Seed: none. Red: `scaffold project` writes no AGENTS.md, CLAUDE.md or skills; `keel docs` is absent (E1051), so the skill list is empty.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  END,
  START,
  blockOf,
  cleanup,
  countLines,
  keel,
  readTree,
  scaffolded,
  skillIds,
  skillPath,
  tokenCount,
} from "./agent-files-support.ts";

let dir = "";
let proj = "";
let tree = new Map<string, string>();
let skills: string[] = [];
let wsDir = "";
let wsTree = new Map<string, string>();

beforeAll(() => {
  ({ dir, proj } = scaffolded());
  tree = readTree(proj);
  skills = skillIds(proj);
  const ws = scaffolded(["--workspace"]);
  wsDir = ws.dir;
  wsTree = readTree(ws.proj);
});
afterAll(() => {
  cleanup(dir);
  cleanup(wsDir);
});

describe("k.scaffold agent files in `scaffold project`", () => {
  it("AGENTS.md has exactly one Keel block between the two marker lines", () => {
    const a = tree.get("AGENTS.md") ?? "";
    expect(countLines(a, START)).toBe(1);
    expect(countLines(a, END)).toBe(1);
    expect(a.indexOf(START)).toBeLessThan(a.indexOf(END));
  });

  it("the block is at most 600 tokens (chars / 4)", () => {
    const b = blockOf(tree.get("AGENTS.md") ?? "");
    expect(b.length).toBeGreaterThan(0);
    expect(tokenCount(b)).toBeLessThanOrEqual(600);
  });

  it("the block contains `keel docs` and `keel explain`", () => {
    const b = blockOf(tree.get("AGENTS.md") ?? "");
    expect(b).toContain("keel docs");
    expect(b).toContain("keel explain");
  });

  it("the block names each listed skill and its .claude/skills/<name>/SKILL.md path", () => {
    const b = blockOf(tree.get("AGENTS.md") ?? "");
    expect(skills.length).toBeGreaterThan(0);
    for (const s of skills) {
      expect(b).toContain(s);
      expect(b).toContain(skillPath(s));
    }
  });

  it("the block contains none of `pnpm spec`, `spec/`, `--workspace`", () => {
    const b = blockOf(tree.get("AGENTS.md") ?? "");
    expect(b.length).toBeGreaterThan(0);
    for (const bad of ["pnpm spec", "spec/", "--workspace"]) expect(b).not.toContain(bad);
  });

  it("CLAUDE.md equals `@AGENTS.md\\n`", () => {
    expect(tree.get("CLAUDE.md")).toBe("@AGENTS.md\n");
  });

  it("one .claude/skills/<name>/SKILL.md per listed skill, equal to the text of `keel docs <name>`", () => {
    expect(skills.length).toBeGreaterThan(0);
    const copies = [...tree.keys()].filter((p) => p.startsWith(".claude/skills/"));
    expect(copies.sort()).toEqual(skills.map(skillPath).sort());
    for (const s of skills) {
      const rec = keel(proj, ["docs", s]).records.find((r) => r.kind === "docs.skill");
      expect(tree.get(skillPath(s))).toBe(rec?.text);
    }
  });

  it("with --workspace, none of AGENTS.md, CLAUDE.md and .claude/ exists", () => {
    expect(wsTree.size).toBeGreaterThan(0);
    expect(wsTree.has("AGENTS.md")).toBe(false);
    expect(wsTree.has("CLAUDE.md")).toBe(false);
    expect([...wsTree.keys()].some((p) => p.startsWith(".claude/"))).toBe(false);
  });
});

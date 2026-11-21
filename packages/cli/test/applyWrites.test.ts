// applyWrites against symlinks: a write whose nearest existing ancestor resolves outside the project, or whose target
// is a symlink, refuses the whole set (E1357 through the binary); nothing outside the project changes. Real temp
// directories under the OS tmpdir, removed after each test.
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { WriteRefused } from "../src/internal/WriteRefused.ts";
import { applyWrites } from "../src/internal/applyWrites.ts";
import { refusedRun } from "../src/internal/refusedRun.ts";

const made: string[] = [];
const tmp = (): string => {
  const d = mkdtempSync(join(tmpdir(), "keel-apply-"));
  made.push(d);
  return d;
};
afterEach(() => {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});
const w = (path: string, content: string | null) => ({ path, content, readonly: false });
const refused = (root: string, writes: ReturnType<typeof w>[]): readonly string[] => {
  try {
    applyWrites(root, writes);
  } catch (e) {
    if (e instanceof WriteRefused) return e.paths;
    throw e;
  }
  return [];
};
const SKILL = ".claude/skills/keel-a/SKILL.md";

describe("applyWrites and symlinks", () => {
  it("`.claude` or `.claude/skills` linked outside: the set is refused and nothing is written anywhere", () => {
    for (const link of [".claude", ".claude/skills"]) {
      const proj = tmp();
      const outside = tmp();
      mkdirSync(join(proj, ".claude"), { recursive: true });
      if (link === ".claude") rmSync(join(proj, ".claude"), { recursive: true });
      symlinkSync(outside, join(proj, link));
      expect(refused(proj, [w("AGENTS.md", "a\n"), w(SKILL, "s\n")])).toEqual([SKILL]);
      expect(readdirSync(outside)).toEqual([]);
      expect(existsSync(join(proj, "AGENTS.md"))).toBe(false);
    }
  });

  it("AGENTS.md and CLAUDE.md that are symlinks, outside or in, are not written through", () => {
    const proj = tmp();
    const outside = tmp();
    writeFileSync(join(outside, "AGENTS.md"), "theirs\n");
    writeFileSync(join(proj, "real.md"), "mine\n");
    symlinkSync(join(outside, "AGENTS.md"), join(proj, "AGENTS.md"));
    symlinkSync(join(proj, "real.md"), join(proj, "CLAUDE.md"));
    expect(refused(proj, [w("AGENTS.md", "a\n"), w("CLAUDE.md", "@AGENTS.md\n"), w("ok.md", "x")])).toEqual([
      "AGENTS.md",
      "CLAUDE.md",
    ]);
    expect(readFileSync(join(outside, "AGENTS.md"), "utf8")).toBe("theirs\n");
    expect(readFileSync(join(proj, "real.md"), "utf8")).toBe("mine\n");
    expect(existsSync(join(proj, "ok.md"))).toBe(false);
  });

  it("a removal through a linked folder and a dangling link on the way are refused", () => {
    const proj = tmp();
    const outside = tmp();
    writeFileSync(join(outside, "SKILL.md"), "keep\n");
    mkdirSync(join(proj, ".claude/skills"), { recursive: true });
    symlinkSync(outside, join(proj, ".claude/skills/keel-a"));
    symlinkSync(join(outside, "gone"), join(proj, "dangling"));
    expect(refused(proj, [w(SKILL, null), w("dangling/x.md", "x")])).toEqual([SKILL, "dangling/x.md"]);
    expect(readFileSync(join(outside, "SKILL.md"), "utf8")).toBe("keep\n");
    expect(readdirSync(outside)).toEqual(["SKILL.md"]);
  });

  it("a project reached through a symlink, and links that stay inside it, still write", () => {
    const real = tmp();
    const via = join(tmp(), "link");
    symlinkSync(real, via);
    mkdirSync(join(real, "docs"));
    symlinkSync(join(real, "docs"), join(real, "alias"));
    applyWrites(via, [w("AGENTS.md", "a\n"), w("alias/x.md", "x\n")]);
    expect(readFileSync(join(real, "AGENTS.md"), "utf8")).toBe("a\n");
    expect(readFileSync(join(real, "docs/x.md"), "utf8")).toBe("x\n");
  });

  it("the binary reports each refused path as E1357, exit 1", () => {
    const r = refusedRun([SKILL], ["docs", "--sync", "--format=json"], { cwd: "/p" });
    expect(r.code).toBe(1);
    const recs = r.stdout
      .trim()
      .split("\n")
      .map((l): unknown => JSON.parse(l));
    expect(recs[0]).toMatchObject({ kind: "diag", code: "E1357", path: SKILL, see: "k.scaffold" });
    expect(recs[1]).toMatchObject({ kind: "summary", ok: false, name: "docs" });
  });
});

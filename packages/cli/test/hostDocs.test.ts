// hostDocs: the binary's loader for `keel docs` and the agent files, on a real temporary tree outside the repo.
import { mkdirSync, rmSync, symlinkSync, truncateSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fixedTime } from "@keel/tooling/test-time";
import { tempDir } from "@keel/tooling/test-tmp";
import { afterAll, describe, expect, it } from "vitest";
import { hostDocs } from "../src/internal/hostDocs.ts";

const dirs: string[] = [];
const tree = (files: Record<string, string>): string => {
  const dir = tempDir("keel-hostdocs-");
  dirs.push(dir);
  for (const [p, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, p)), { recursive: true });
    writeFileSync(join(dir, p), text);
  }
  return dir;
};
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});
const paths = (cwd: string, scope: "docs" | "query" | "tree"): string[] => hostDocs(cwd, scope).map((f) => f.path);

describe("hostDocs", () => {
  it("installed: the root's package.json, the running cli, and each named or present @keel package", () => {
    const dir = tree({
      "package.json": JSON.stringify({ dependencies: { "@keel/router": "*", "@keel/gone": "*" } }),
      "node_modules/@keel/router/package.json": '{"name":"@keel/router","version":"2.0.0"}',
      "node_modules/@keel/router/docs/index.json": '{"sections":[]}',
      "node_modules/@keel/router/docs/k.router.md": "# k.router\n",
      "node_modules/@keel/extra/package.json": '{"name":"@keel/extra","version":"1.0.0"}',
      "AGENTS.md": "# mine\n",
      ".claude/skills/keel-a/SKILL.md": "copy\n",
      "src/app/x.ts": "",
    });
    const got = paths(join(dir, "src/app"), "docs");
    expect(got).toContain("package.json");
    expect(got).toContain("node_modules/@keel/cli/package.json");
    expect(got).toContain("node_modules/@keel/router/docs/k.router.md");
    expect(got).toContain("node_modules/@keel/extra/package.json");
    expect(got.some((p) => p.includes("@keel/gone"))).toBe(false);
    expect(got).not.toContain("AGENTS.md");
    const atRoot = paths(dir, "docs");
    expect(atRoot).toContain("AGENTS.md");
    expect(atRoot).toContain(".claude/skills/keel-a/SKILL.md");
    expect(paths(dir, "query")).toContain("AGENTS.md");
    expect(paths(join(dir, "src"), "query")).toEqual([]);
    expect(paths(dir, "tree").every((p) => p.startsWith("node_modules/@keel/cli/skills/"))).toBe(true);
  });

  it("the Keel repo: spec/**.md and packages/cli/skills from a folder below the map", () => {
    const dir = tree({
      "spec/00-map.md": "# map\n",
      "spec/kernel/k.a.md": "# k.a\n",
      "spec/std/s.b.md": "# s.b\n",
      "spec/kernel/notes.txt": "x",
      "packages/cli/skills/keel-a/SKILL.md": "skill\n",
      "apps/one/package.json": "{}",
    });
    expect(paths(join(dir, "apps/one"), "docs")).toEqual([
      "spec/00-map.md",
      "spec/kernel/k.a.md",
      "spec/std/s.b.md",
      "packages/cli/skills/keel-a/SKILL.md",
    ]);
  });

  it("a package folder that is a symlink into a store outside the project still reads", () => {
    const store = tree({
      "package.json": '{"name":"@keel/router","version":"2.0.0"}',
      "docs/index.json": '{"sections":[]}',
      "docs/k.router.md": "# k.router\n",
    });
    const dir = tree({ "package.json": JSON.stringify({ dependencies: { "@keel/router": "*" } }) });
    mkdirSync(join(dir, "node_modules/@keel"), { recursive: true });
    symlinkSync(store, join(dir, "node_modules/@keel/router"));
    const got = hostDocs(dir, "docs");
    expect(got.find((f) => f.path === "node_modules/@keel/router/docs/k.router.md")?.source).toBe("# k.router\n");
  });

  it("a docs/ folder, a section file or a skill whose real path leaves the package is not read", () => {
    const outside = tree({ "zz.md": "# outside\n", "index.json": '{"sections":[]}', "SKILL.md": "outside\n" });
    const dir = tree({
      "package.json": JSON.stringify({ dependencies: { "@keel/evil": "*", "@keel/sly": "*" } }),
      "node_modules/@keel/evil/package.json": '{"name":"@keel/evil","version":"1.0.0"}',
      "node_modules/@keel/sly/package.json": '{"name":"@keel/sly","version":"1.0.0"}',
      "node_modules/@keel/sly/docs/index.json": '{"sections":[]}',
      "node_modules/@keel/sly/docs/k.ok.md": "# ok\n",
    });
    symlinkSync(outside, join(dir, "node_modules/@keel/evil/docs"));
    symlinkSync(join(outside, "zz.md"), join(dir, "node_modules/@keel/sly/docs/zz.md"));
    const got = paths(dir, "docs");
    expect(got).toContain("node_modules/@keel/evil/package.json");
    expect(got.some((p) => p.startsWith("node_modules/@keel/evil/docs/"))).toBe(false);
    expect(got).toContain("node_modules/@keel/sly/docs/k.ok.md");
    expect(got).not.toContain("node_modules/@keel/sly/docs/zz.md");
    const repo = tree({ "spec/00-map.md": "# map\n", "packages/cli/skills/keel-a/SKILL.md": "skill\n" });
    mkdirSync(join(repo, "packages/cli/skills/keel-b"));
    symlinkSync(join(outside, "SKILL.md"), join(repo, "packages/cli/skills/keel-b/SKILL.md"));
    const inRepo = paths(repo, "docs");
    expect(inRepo).toContain("packages/cli/skills/keel-a/SKILL.md");
    expect(inRepo).not.toContain("packages/cli/skills/keel-b/SKILL.md");
  });

  it("a docs or skill file over 1,000,000 bytes is not read", () => {
    const dir = tree({
      "package.json": JSON.stringify({ dependencies: { "@keel/router": "*" } }),
      "node_modules/@keel/router/package.json": '{"name":"@keel/router","version":"2.0.0"}',
      "node_modules/@keel/router/docs/k.big.md": "",
      "node_modules/@keel/router/docs/k.edge.md": "",
    });
    truncateSync(join(dir, "node_modules/@keel/router/docs/k.big.md"), fixedTime(1_000_001));
    truncateSync(join(dir, "node_modules/@keel/router/docs/k.edge.md"), fixedTime(1_000_000));
    const got = paths(dir, "docs");
    expect(got).not.toContain("node_modules/@keel/router/docs/k.big.md");
    expect(got).toContain("node_modules/@keel/router/docs/k.edge.md");
    const repo = tree({ "spec/00-map.md": "# map\n", "packages/cli/skills/keel-a/SKILL.md": "" });
    truncateSync(join(repo, "packages/cli/skills/keel-a/SKILL.md"), fixedTime(1_000_001));
    expect(paths(repo, "docs")).not.toContain("packages/cli/skills/keel-a/SKILL.md");
  });
});

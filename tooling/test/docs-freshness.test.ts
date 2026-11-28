import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { tempDir } from "@keel/tooling/test-tmp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { freshness, parseSubject, pathspecs } from "../docs-freshness.mjs";

describe("parseSubject", () => {
  it("reads globs split by spaces or commas", () => {
    expect(parseSubject("# T\n\nsubject: packages/ui/src/brand*, docs/brand/  spec/a.md\nverified: abc1234\n")).toEqual(
      ["packages/ui/src/brand*", "docs/brand/", "spec/a.md"],
    );
  });
  it("is undefined without a subject line", () => {
    expect(parseSubject("# T\nverified: abc1234\n")).toBeUndefined();
  });
});

describe("pathspecs", () => {
  it("names each glob and everything under it", () => {
    expect(pathspecs(["docs/brand/"])).toEqual([":(glob)docs/brand", ":(glob)docs/brand/**"]);
  });
});

describe("freshness", () => {
  let root = "";
  const git = (...a: string[]) => execFileSync("git", a, { cwd: root, stdio: "pipe" });
  const write = (f: string, text: string) => {
    fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
    fs.writeFileSync(path.join(root, f), text);
  };
  const commit = (f: string, text: string) => {
    write(f, text);
    git("add", "-A");
    git("commit", "-q", "-m", `touch ${f}`);
  };
  const codes = () => freshness(root, 2).diags.map((d) => `${d.code} ${d.path}`);

  beforeEach(() => {
    root = tempDir("keel-fresh-");
    git("init", "-q");
    git("config", "user.email", "t@example.com");
    git("config", "user.name", "t");
    // A machine's own commit signing costs a process per commit; these commits need none.
    git("config", "commit.gpgsign", "false");
    commit("docs/A.md", "# A\n\nsubject: src/a/\nverified: 0000000\n");
    commit("docs/B.md", "# B\n");
    commit("packages/p/README.md", "# p\n");
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it("ages a doc only on commits to its subject", () => {
    for (let i = 0; i < 3; i++) commit(`src/other/${i}.ts`, "x");
    expect(codes()).toEqual(["W0014 docs/B.md"]);
    for (let i = 0; i < 3; i++) commit(`src/a/deep/${i}.ts`, "x");
    expect(codes()).toContain("D0001 docs/A.md");
  });

  it("matches a glob's wildcard against a directory and the files under it", () => {
    commit("docs/A.md", "# A\n\nsubject: src/a*\n");
    for (let i = 0; i < 3; i++) commit(`src/abc/${i}.ts`, "x");
    expect(codes()).toContain("D0001 docs/A.md");
  });

  it("ages a README on its package's src/ and nothing else", () => {
    for (let i = 0; i < 3; i++) commit(`packages/p/test/${i}.ts`, "x");
    expect(codes()).not.toContain("D0001 packages/p/README.md");
    for (let i = 0; i < 3; i++) commit(`packages/p/src/${i}.ts`, "x");
    expect(codes()).toContain("D0001 packages/p/README.md");
  });

  it("warns once per doc with no subject, which still ages on all of docs/", () => {
    commit("docs/C.md", "# C\n\nsubject: src/c\n");
    const w = freshness(root, 2).diags.filter((d) => d.code === "W0014");
    expect(w.map((d) => d.path)).toEqual(["docs/B.md"]);
    for (let i = 0; i < 3; i++) commit(`docs/notes/${i}.md`, "x");
    expect(codes()).toContain("D0001 docs/B.md");
    expect(codes()).not.toContain("D0001 docs/C.md");
  });

  it("does not age on a commit touching only docs/HANDOFF.md", () => {
    for (let i = 0; i < 3; i++) commit("docs/HANDOFF.md", `# H ${i}\n\nsubject: tasks/\n`);
    expect(codes()).not.toContain("D0001 docs/B.md");
  });
});

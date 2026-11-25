import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { buildReport, checkedParts, dirtyInputs, feedsReport } from "../evidence.mjs";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "keel-evidence-dirty-"));
afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

const git = (...args: string[]) => {
  const r = spawnSync(
    "git",
    ["-c", "user.name=t", "-c", "user.email=t@example.com", "-c", "commit.gpgsign=false", ...args],
    {
      cwd: root,
      encoding: "utf8",
    },
  );
  expect(r.status).toBe(0);
};
const put = (rel: string, text: string) => {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text);
};

put("packages/a/package.json", "{}");
put("packages/a/src/x.ts", "export const x = 1;\n");
put("packages/a/test/x.test.ts", 'it("one", () => {});\n');
put("spec/kernel/k.one.md", "# k.one\nstatus: proposed\n");
put("tooling/ledger/ledger.json", "{}\n");
put("tooling/ledger/evidence.json", "{}\n");
git("init", "-q");
git("add", "-A");
git("commit", "-q", "-m", "base");

const ledger = { unsafe: 0, rungs: {}, clauses: [], exports: [], a11y: [] };

describe("feedsReport", () => {
  it("accepts spec sections, unit manifests and test files only", () => {
    expect(feedsReport("spec/kernel/k.one.md")).toBe(true);
    expect(feedsReport("spec/std/std.two.md")).toBe(true);
    expect(feedsReport("packages/a/package.json")).toBe(true);
    expect(feedsReport("apps/app/modules/m/test/w.test.tsx")).toBe(true);
    expect(feedsReport("packages/a/src/x.ts")).toBe(false);
    expect(feedsReport("tooling/ledger/ledger.json")).toBe(false);
    expect(feedsReport("tooling/ledger/evidence.json")).toBe(false);
    expect(feedsReport("tooling/test/x.test.ts")).toBe(false);
  });
});

describe("dirtyInputs", () => {
  it("is empty on a clean tree", () => {
    expect(dirtyInputs(root)).toEqual([]);
  });

  it("ignores changes to files the report does not read, the ledger file and its own output", () => {
    put("packages/a/src/x.ts", "export const x = 2;\n");
    put("tooling/ledger/ledger.json", '{"a":1}\n');
    put("tooling/ledger/evidence.json", '{"a":1}\n');
    put("notes.txt", "scratch\n");
    expect(dirtyInputs(root)).toEqual([]);
  });

  it("lists a modified test file, a modified spec section and an untracked test file", () => {
    put("packages/a/test/x.test.ts", 'it("one", () => {});\nit("two", () => {});\n');
    put("spec/kernel/k.one.md", "# k.one\nstatus: conformance-covered\n");
    put("packages/a/test/new.test.ts", 'it("new", () => {});\n');
    expect(dirtyInputs(root)).toEqual([
      "packages/a/test/new.test.ts",
      "packages/a/test/x.test.ts",
      "spec/kernel/k.one.md",
    ]);
  });

  it("lists a deleted test file and both sides of a staged rename", () => {
    git("checkout", "--", ".");
    fs.rmSync(path.join(root, "packages/a/test/new.test.ts"));
    git("mv", "packages/a/test/x.test.ts", "packages/a/test/y.test.ts");
    expect(dirtyInputs(root)).toEqual(["packages/a/test/x.test.ts", "packages/a/test/y.test.ts"]);
    git("mv", "packages/a/test/y.test.ts", "packages/a/test/x.test.ts");
    expect(dirtyInputs(root)).toEqual([]);
  });

  it("is empty outside a git checkout", () => {
    const bare = fs.mkdtempSync(path.join(os.tmpdir(), "keel-evidence-nogit-"));
    try {
      expect(dirtyInputs(bare)).toEqual([]);
    } finally {
      fs.rmSync(bare, { recursive: true, force: true });
    }
  });
});

describe("a report taken from a dirty tree", () => {
  const base = { root, ledger, commit: "c", generatedAt: "t" };

  it("carries the dirty paths only when there are some", () => {
    expect(buildReport(base)).not.toHaveProperty("dirty");
    expect(buildReport({ ...base, dirty: ["spec/kernel/k.one.md"] })).toHaveProperty("dirty", ["spec/kernel/k.one.md"]);
  });

  it("never equals a fresh one under --check", () => {
    const clean = buildReport(base);
    const marked = buildReport({ ...base, dirty: ["spec/kernel/k.one.md"] });
    expect(checkedParts(clean)).toBe(checkedParts(buildReport(base)));
    expect(checkedParts(marked)).not.toBe(checkedParts(clean));
  });
});

// gitSource (k.evidence manifest `source`): the commit checked out at a directory and whether the tree differs from
// it, the bundle directory aside; null outside a git work tree. Each case builds a small repository in the OS
// temp directory with `git`; nothing reaches a network. Seed 1337.
import { spawnSync } from "node:child_process";
import { mkdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tempDir } from "@keel/tooling/test-tmp";
import fc from "fast-check";
import { afterAll, describe, expect, test } from "vitest";
import { gitSource } from "../src/internal/gitSource.ts";

const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});
const git = (cwd: string, ...args: string[]): string => {
  const r = spawnSync(
    "git",
    ["-c", "user.name=t", "-c", "user.email=t@example.test", "-c", "commit.gpgsign=false", ...args],
    { cwd, encoding: "utf8" },
  );
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
};
const dir = (): string => {
  const d = realpathSync(tempDir("keel-git-"));
  dirs.push(d);
  return d;
};
const put = (root: string, path: string, text = "x\n"): void => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
};
/** A repository with one commit holding `a.txt` and `sub/b.txt`. */
const repo = (): string => {
  const root = dir();
  git(root, "init", "-q");
  put(root, "a.txt");
  put(root, "sub/b.txt");
  git(root, "add", ".");
  git(root, "commit", "-q", "-m", "one");
  return root;
};

describe("gitSource", () => {
  test("gitSource outside a git work tree is null; so is a repository with no commit", () => {
    const plain = dir();
    expect(gitSource(plain, join(plain, "out"))).toBeNull();
    const fresh = dir();
    git(fresh, "init", "-q");
    expect(gitSource(fresh, join(fresh, "out"))).toBeNull();
  });

  test("a clean checkout is its HEAD commit, not dirty", () => {
    const root = repo();
    const head = git(root, "rev-parse", "HEAD");
    expect(gitSource(root, join(root, "out"))).toEqual({ commit: head, dirty: false });
    expect(head).toMatch(/^[0-9a-f]{40}$/);
  });

  test("an untracked file, a modified file or a deleted file makes it dirty; the commit stays HEAD", () => {
    const head = (r: string): string => git(r, "rev-parse", "HEAD");
    const untracked = repo();
    put(untracked, "new.txt");
    expect(gitSource(untracked, join(untracked, "out"))).toEqual({ commit: head(untracked), dirty: true });
    const modified = repo();
    put(modified, "a.txt", "changed\n");
    expect(gitSource(modified, join(modified, "out"))?.dirty).toBe(true);
    const staged = repo();
    put(staged, "a.txt", "changed\n");
    git(staged, "add", "a.txt");
    expect(gitSource(staged, join(staged, "out"))?.dirty).toBe(true);
    const deleted = repo();
    rmSync(join(deleted, "a.txt"));
    expect(gitSource(deleted, join(deleted, "out"))?.dirty).toBe(true);
  });

  test("files under the bundle directory do not count, while others still do", () => {
    const root = repo();
    put(root, "evidence/2026-01-01/manifest.json");
    expect(gitSource(root, join(root, "evidence", "2026-01-01"))?.dirty).toBe(false);
    expect(gitSource(root, join(root, "evidence"))?.dirty).toBe(false);
    put(root, "other.txt");
    expect(gitSource(root, join(root, "evidence", "2026-01-01"))?.dirty).toBe(true);
  });

  test("a bundle directory outside the tree, or the tree itself, excludes nothing", () => {
    const root = repo();
    put(root, "new.txt");
    expect(gitSource(root, join(dir(), "out"))?.dirty).toBe(true);
    expect(gitSource(root, join(root, "..", "elsewhere"))?.dirty).toBe(true);
    expect(gitSource(root, root)?.dirty).toBe(true);
    const clean = repo();
    expect(gitSource(clean, clean)?.dirty).toBe(false);
  });

  test("a subdirectory is judged by its own files: changes elsewhere in the tree do not count", () => {
    const root = repo();
    put(root, "a.txt", "changed\n");
    const sub = join(root, "sub");
    expect(gitSource(sub, join(sub, "out"))).toEqual({ commit: git(root, "rev-parse", "HEAD"), dirty: false });
    put(root, "sub/c.txt");
    expect(gitSource(sub, join(sub, "out"))?.dirty).toBe(true);
    put(root, "sub/out/m.json");
    const only = repo();
    put(only, "sub/out/m.json");
    expect(gitSource(join(only, "sub"), join(only, "sub", "out"))?.dirty).toBe(false);
  });

  test("a directory that does not exist is null", () => {
    const root = dir();
    expect(gitSource(join(root, "nope"), join(root, "nope", "out"))).toBeNull();
  });

  test("property: dirty is exactly whether some new file lies outside the bundle directory", () => {
    const names = fc.uniqueArray(fc.stringMatching(/^[a-z]{3,8}$/), { maxLength: 4 });
    fc.assert(
      fc.property(names, names, (inside, outside) => {
        const tree = repo();
        for (const f of inside) put(tree, `bundle/${f}.txt`);
        for (const f of outside) put(tree, `loose/${f}.txt`);
        expect(gitSource(tree, join(tree, "bundle"))).toEqual({
          commit: git(tree, "rev-parse", "HEAD"),
          dirty: outside.length > 0,
        });
      }),
      { seed: 1337, numRuns: 12 },
    );
  });
});

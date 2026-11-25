// Spec: k.shell, Conformance "(Files) with `deploy/web/tauri/` a symlink to a folder outside the project, or `deploy/web/tauri/a.json` a symlink, `keel check` reports one E1585 and `keel build` writes nothing under `deploy/web/tauri/` or the link's target."
// Spec: k.shell, Files "`files` gives the shell files, read-only deploy files (k.deploy; E1005, fix: the regenerated file); a path with a `..` segment, a `\\` or a leading `/`, or one a link carries out of the folder (k.scaffold Links), is E1585: none of the set is written. Another file there is the app's. Removing a shell removes its files."
// Seed: 1337 (no generated input: the two link shapes are the closed set).
// Over a stub `@keel/std-tauri` (`shell-stub.ts`) with real temp directories and real symlinks. The link target lives in a second temp directory outside the project.
// ASSUMPTION: "writes nothing" is read as: the target folder or file is byte for byte unchanged, no entry appears beside it, and the stub's `build` is never called.
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { SLOW, buildCalls, cleanup, run, stubProject, withCode } from "./shell-stub.ts";

let dir = "";
let outer = "";
beforeEach(() => {
  dir = stubProject();
  outer = mkdtempSync(join(tmpdir(), "keel-link-"));
}, SLOW);
afterEach(() => {
  cleanup(dir);
  rmSync(outer, { recursive: true, force: true });
});

const snapshot = (root: string): Record<string, string> => {
  const out: Record<string, string> = {};
  const walk = (rel: string): void => {
    for (const name of readdirSync(join(root, rel)).sort()) {
      const p = rel === "" ? name : `${rel}/${name}`;
      try {
        out[p] = readFileSync(join(root, p), "utf8");
      } catch {
        walk(p);
      }
    }
  };
  walk("");
  return out;
};

describe("k.shell: Files, a symlink in the shell folder", () => {
  test(
    "`deploy/web/tauri/` a symlink to a folder outside the project: `keel check` reports one E1585 and `keel build` writes nothing under `deploy/web/tauri/` or the link's target.",
    () => {
      const target = join(outer, "elsewhere");
      mkdirSync(target);
      writeFileSync(join(target, "keep.txt"), "mine\n");
      mkdirSync(join(dir, "deploy/web"), { recursive: true });
      symlinkSync(target, join(dir, "deploy/web/tauri"));
      const before = snapshot(target);

      expect(withCode(run(dir, ["check"]), "E1585")).toHaveLength(1);
      expect(snapshot(target)).toEqual(before);

      run(dir, ["build", "--target", "tauri"]);
      expect(snapshot(target)).toEqual(before);
      expect(snapshot(join(dir, "deploy/web/tauri"))).toEqual(before);
      expect(buildCalls(dir)).toEqual([]);
    },
    SLOW,
  );

  test(
    "`deploy/web/tauri/a.json` a symlink: `keel check` reports one E1585 and `keel build` writes nothing under `deploy/web/tauri/` or the link's target.",
    () => {
      const target = join(outer, "target.json");
      writeFileSync(target, "outside\n");
      mkdirSync(join(dir, "deploy/web/tauri"), { recursive: true });
      symlinkSync(target, join(dir, "deploy/web/tauri/a.json"));
      const before = readFileSync(target, "utf8");

      expect(withCode(run(dir, ["check"]), "E1585")).toHaveLength(1);
      expect(readFileSync(target, "utf8")).toBe(before);

      run(dir, ["build", "--target", "tauri"]);
      expect(readFileSync(target, "utf8")).toBe(before);
      expect(readdirSync(join(dir, "deploy/web/tauri"))).toEqual(["a.json"]);
      expect(readFileSync(join(dir, "deploy/web/tauri/a.json"), "utf8")).toBe(before);
      expect(buildCalls(dir)).toEqual([]);
    },
    SLOW,
  );
});

// `realPaths`: one pass's real-path lookup gives `fs.realpathSync`'s answer for every path (undefined where it throws),
// through links to files and folders, chains of links, dangling links and missing paths.
import fs from "node:fs";
import path from "node:path";
import { tempDir } from "@keel/tooling/test-tmp";
import fc from "fast-check";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { realPaths } from "../src/internal/realPaths.ts";

let root = "";
beforeEach(() => {
  root = tempDir(".tmp-realPaths-", import.meta.dirname);
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

const truth = (p: string): string | undefined => {
  try {
    return fs.realpathSync(p);
  } catch {
    return undefined;
  }
};

const isDir = (p: string): boolean => {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
};

/** The paths a generated tree may hold, and each target a link may name. */
const NAMES = ["a", "b", "c", "a/x", "b/y", "c/z", "a/x/f", "b/y/g"];

describe("realPaths", () => {
  it("answers as fs.realpathSync for every path of generated trees of folders, files and links (seed 1337)", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(fc.constantFrom(...NAMES), fc.constantFrom("dir", "file", "link"), fc.constantFrom(...NAMES)),
          {
            maxLength: 10,
          },
        ),
        (ops) => {
          const at = fs.mkdtempSync(path.join(root, "t-"));
          for (const [name, kind, target] of ops) {
            const p = path.join(at, name);
            if (fs.existsSync(p) || !isDir(path.dirname(p))) continue;
            try {
              fs.lstatSync(p);
              continue;
            } catch {
              // absent, a dangling link included: made below
            }
            if (kind === "dir") fs.mkdirSync(p);
            else if (kind === "file") fs.writeFileSync(p, "x");
            else fs.symlinkSync(path.join(at, target), p);
          }
          const real = realPaths();
          for (const name of [...NAMES, "a/missing", "missing/deeper", "a/x/f/under-a-file"]) {
            const p = path.join(at, name);
            expect(real(p), name).toBe(truth(p));
            expect(real(p), `${name} again`).toBe(truth(p));
          }
        },
      ),
      { seed: 1337, numRuns: 60 },
    );
  });

  it("resolves a relative path from the working folder and the root folder to itself", () => {
    const real = realPaths();
    expect(real("/")).toBe("/");
    expect(real(".")).toBe(truth("."));
  });
});

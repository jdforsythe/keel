// `hashFile` (k.derived Derivation cache): the digest of a file's bytes now, whatever was hashed before in the
// process: a rewrite to bytes of the same size with the old modification time set back, a rename of another file
// over it, its removal, and a rewrite right after a read are each seen.
import fs from "node:fs";
import path from "node:path";
import { tempDir } from "@keel/tooling/test-tmp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hashFile } from "../src/internal/derived/hashFile.ts";
import { sha256Hex } from "../src/internal/sha256Hex.ts";

let root = "";
beforeEach(() => {
  root = tempDir(".tmp-hashFile-", import.meta.dirname);
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

const digest = (text: string): string => sha256Hex(new TextEncoder().encode(text));
/** Writes `text` at `file` with an old modification time. */
const settledAt = (file: string, text: string): void => {
  fs.writeFileSync(file, text);
  fs.utimesSync(file, 1_700_000_000, 1_700_000_000);
};
/** A clock three seconds past `file`'s status change time when first asked: a digest read then is kept. */
const later = (file: string): (() => number) => {
  const at = fs.statSync(file).ctimeMs + 3_000;
  return () => at;
};

describe("hashFile", () => {
  it("is the SHA-256 of the bytes, undefined for a missing file or a folder", () => {
    const f = path.join(root, "a.txt");
    fs.writeFileSync(f, "one");
    expect(hashFile(f)).toBe(digest("one"));
    expect(hashFile(path.join(root, "none"))).toBeUndefined();
    expect(hashFile(root)).toBeUndefined();
  });

  it("sees a same-size rewrite whose modification time is set back to the old one", () => {
    const f = path.join(root, "a.txt");
    settledAt(f, "one");
    const clock = later(f);
    const old = fs.statSync(f);
    expect(hashFile(f, clock)).toBe(digest("one"));
    fs.writeFileSync(f, "two");
    fs.utimesSync(f, old.atime, old.mtime);
    expect(hashFile(f, clock)).toBe(digest("two"));
  });

  it("sees a rewrite right after a read, within one clock tick", () => {
    const f = path.join(root, "a.txt");
    for (let i = 0; i < 20; i += 1) {
      fs.writeFileSync(f, `v${String(i % 10)}`);
      expect(hashFile(f)).toBe(digest(`v${String(i % 10)}`));
    }
  });

  it("sees another file renamed over it with the same size and times, and its removal", () => {
    const f = path.join(root, "a.txt");
    const g = path.join(root, "b.txt");
    settledAt(f, "one");
    const clock = later(f);
    expect(hashFile(f, clock)).toBe(digest("one"));
    fs.writeFileSync(g, "two");
    const t = fs.statSync(f);
    fs.utimesSync(g, t.atime, t.mtime);
    fs.renameSync(g, f);
    expect(hashFile(f, clock)).toBe(digest("two"));
    fs.rmSync(f);
    expect(hashFile(f, clock)).toBeUndefined();
  });

  it("gives a settled file's digest again while it is unchanged", () => {
    const f = path.join(root, "a.txt");
    settledAt(f, "one");
    const clock = later(f);
    expect(hashFile(f, clock)).toBe(digest("one"));
    expect(hashFile(f, clock)).toBe(digest("one"));
  });
});

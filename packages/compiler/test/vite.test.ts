// The Vite plugin: per-module compile, merged artifacts, skip unchanged writes, atomic writes, eviction.
import fs from "node:fs";
import path from "node:path";
import keel from "@keel/compiler/vite";
import { tempDir } from "@keel/tooling/test-tmp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

let root = "";
beforeEach(() => {
  root = tempDir(".tmp-vite-", import.meta.dirname);
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

const read = (name: string): { data: Record<string, unknown>; hash: string } => {
  const v: unknown = JSON.parse(fs.readFileSync(path.join(root, ".keel", name), "utf8"));
  if (typeof v !== "object" || v === null || !("data" in v) || !("hash" in v)) throw new Error("bad artifact");
  const data: unknown = v.data;
  if (typeof data !== "object" || data === null || typeof v.hash !== "string") throw new Error("bad artifact");
  return { data: Object.fromEntries(Object.entries(data)), hash: v.hash };
};

describe("@keel/compiler/vite", () => {
  it("merges per-module artifacts, skips unchanged writes, evicts deleted modules", () => {
    const p = keel();
    p.configResolved({ root });
    const a = path.join(root, "src/A.tsx");
    const b = path.join(root, "src/B.tsx");
    expect(p.transform("export default function A() { return <p>a</p> }", a)?.code).toContain("template(");
    p.transform("export default function B() { return <b>b</b> }", b);
    expect(Object.keys(read("ids.json").data)).toEqual(["src.A.0", "src.B.0"]);
    const file = path.join(root, ".keel", "ids.json");
    const ino = fs.statSync(file).ino;
    p.transform("export default function A() { return <p>a</p> }", a);
    expect(fs.statSync(file).ino).toBe(ino);
    expect((fs.statSync(file).mode & 0o777).toString(8)).toBe("444");
    expect(fs.readdirSync(path.join(root, ".keel")).sort()).toEqual([
      "a11y.json",
      "deps.json",
      "ids.json",
      "routes.json",
      "std.json",
      "styles.json",
    ]);
    p.watchChange(b, { event: "delete" });
    expect(Object.keys(read("ids.json").data)).toEqual(["src.A.0"]);
  });

  it("fails a module on diagnostics and on an id another module already claims", () => {
    const p = keel();
    p.configResolved({ root });
    expect(() =>
      p.transform("export default function C() { return <a href='javascript:x'>c</a> }", path.join(root, "C.tsx")),
    ).toThrow(/^E1003 C.tsx:1:/);
    p.transform('export default function D() { return <p id="dup">d</p> }', path.join(root, "D.tsx"));
    expect(() =>
      p.transform('export default function E() { return <p id="dup">e</p> }', path.join(root, "E.tsx")),
    ).toThrow(/E1404/);
  });

  it("ignores non-code and node_modules ids", () => {
    const p = keel();
    p.configResolved({ root });
    expect(p.transform("x", path.join(root, "a.css"))).toBeNull();
    expect(p.transform("x", path.join(root, "node_modules/x/index.js"))).toBeNull();
  });
});

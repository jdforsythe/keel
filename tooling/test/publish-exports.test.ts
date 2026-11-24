import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { builtPath, checkPackage, deriveExports, fixPackage, readPackages, shipped } from "../publish-exports.mjs";

const scratch: string[] = [];
afterEach(() => {
  for (const d of scratch.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

/** A repo with one package `p`: its manifest and the files it holds. */
function repo(manifest: Record<string, unknown>, files: string[]): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "publish-exports-"));
  scratch.push(root);
  const put = (rel: string, text: string) => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  };
  put("packages/p/package.json", JSON.stringify(manifest));
  for (const f of files) put(`packages/p/${f}`, "");
  return root;
}
const codes = (root: string) => readPackages(root).flatMap((p) => checkPackage(p, root).map((d) => d.code));
const exportsOf = { ".": { types: "./src/index.ts", default: "./src/index.ts" }, "./css": "./fonts/f.css" };

describe("deriving the packed exports", () => {
  it("maps source to built files and leaves assets and declarations alone", () => {
    expect(builtPath("./src/a.ts", "types")).toBe("./dist/src/a.d.ts");
    expect(builtPath("./module.ts", "default")).toBe("./dist/module.js");
    expect(builtPath("./fonts/f.css", "default")).toBe("./fonts/f.css");
    expect(builtPath("./x.d.ts", "types")).toBe("./x.d.ts");
    expect(deriveExports({ "./s/*": { types: "./src/s/*.ts", default: "./src/s/*.ts" } })).toEqual({
      "./s/*": { types: "./dist/src/s/*.d.ts", default: "./dist/src/s/*.js" },
    });
  });
  it("tells what `files` ships", () => {
    expect(shipped("./dist/a.js", ["dist"])).toBe(true);
    expect(shipped("./distant/a.js", ["dist"])).toBe(false);
    expect(shipped("./package.json", [])).toBe(true);
  });
});

describe("checking a package", () => {
  const manifest = { name: "p", exports: exportsOf, files: ["dist", "fonts"] };
  const built = ["dist/src/index.js", "dist/src/index.d.ts", "fonts/f.css"];
  it("reports a missing counterpart, then passes once fixed against a build", () => {
    const root = repo(manifest, built);
    expect(codes(root)).toEqual(["P0001", "P0001"]);
    for (const p of readPackages(root)) fixPackage(p);
    expect(codes(root)).toEqual([]);
  });
  it("reports a path no build wrote and one outside files", () => {
    const root = repo({ ...manifest, publishConfig: { exports: deriveExports(exportsOf) } }, ["fonts/f.css"]);
    expect(codes(root)).toEqual(["P0002", "P0002"]);
    const out = repo({ ...manifest, files: ["fonts"], publishConfig: { exports: deriveExports(exportsOf) } }, built);
    expect(codes(out)).toEqual(["P0003", "P0003"]);
  });
  it("matches a * pattern against built files", () => {
    const m = { name: "p", exports: { "./s/*": "./src/s/*.ts" }, files: ["dist"] };
    expect(codes(repo({ ...m, publishConfig: { exports: deriveExports(m.exports) } }, []))).toEqual(["P0002"]);
    expect(codes(repo({ ...m, publishConfig: { exports: deriveExports(m.exports) } }, ["dist/src/s/a.js"]))).toEqual(
      [],
    );
  });
  it("holds a bin that points at source to a publishConfig.bin", () => {
    const m = { name: "p", bin: { k: "./src/bin.ts" }, files: ["dist"] };
    expect(codes(repo(m, ["src/bin.ts"]))).toEqual(["P0004"]);
    expect(codes(repo({ ...m, publishConfig: { bin: { k: "./dist/src/bin.js" } } }, ["dist/src/bin.js"]))).toEqual([]);
  });
});

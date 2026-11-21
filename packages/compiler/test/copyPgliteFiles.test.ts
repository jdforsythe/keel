// std.postgres Modes (`pglite:` on disk) for a built `server.mjs`: the bundle reads PGlite's files beside itself, so the
// server build copies them into the deployable's folder.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { copyPgliteFiles } from "../src/internal/copyPgliteFiles.ts";

let root = "";
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "keel-pglite-files-"));
  fs.mkdirSync(path.join(root, "out"));
  fs.mkdirSync(path.join(root, "dist"));
  for (const f of ["initdb.wasm", "pglite.data", "pglite.wasm", "index.js"])
    fs.writeFileSync(path.join(root, "dist", f), f);
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

const out = () => path.join(root, "out");
const server = (text: string) => fs.writeFileSync(path.join(out(), "server.mjs"), text);

describe("copyPgliteFiles", () => {
  it("copies the three runtime files when server.mjs reads them", () => {
    server('const w = new URL("./pglite.wasm", import.meta.url);');
    expect(copyPgliteFiles(out(), () => path.join(root, "dist"))).toEqual([
      "initdb.wasm",
      "pglite.data",
      "pglite.wasm",
    ]);
    expect(fs.readFileSync(path.join(out(), "pglite.data"), "utf8")).toBe("pglite.data");
    expect(fs.existsSync(path.join(out(), "index.js"))).toBe(false);
  });
  it("copies nothing and resolves nothing for a bundle without PGlite or with no server.mjs", () => {
    let asked = 0;
    const distOf = () => {
      asked++;
      return path.join(root, "dist");
    };
    expect(copyPgliteFiles(out(), distOf)).toEqual([]);
    server("export {};");
    expect(copyPgliteFiles(out(), distOf)).toEqual([]);
    expect(asked).toBe(0);
    expect(fs.readdirSync(out())).toEqual(["server.mjs"]);
  });
  it("skips a file the package lacks and throws when the package is not found", () => {
    server('new URL("./pglite.wasm", import.meta.url)');
    fs.rmSync(path.join(root, "dist", "initdb.wasm"));
    expect(copyPgliteFiles(out(), () => path.join(root, "dist"))).toEqual(["pglite.data", "pglite.wasm"]);
    expect(() => copyPgliteFiles(out(), () => undefined)).toThrow(/@electric-sql\/pglite is not found/);
  });
});

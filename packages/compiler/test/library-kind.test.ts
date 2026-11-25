// k.library Kind and In an app: `libraryKind`, `libraryFiles`, and the gates that read a library by kind
// (`importDeps`, `stdPlacedExports`). Seed 1337 (fast-check, recorded in each fc.assert).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { importDeps } from "@keel/compiler/std/importDeps";
import { libraryFiles } from "@keel/compiler/std/libraryFiles";
import { libraryKind } from "@keel/compiler/std/libraryKind";
import { stdPlacedExports } from "@keel/compiler/std/stdPlacedExports";
import fc from "fast-check";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const SEED = 1337;
const part = fc.stringMatching(/^[a-z][a-z0-9-]{0,7}$/);
const scoped = fc.tuple(part, part).map(([a, b]) => `@${a}/${b}`);

describe("libraryKind", () => {
  it("is library for a scoped package marked keel: library, std for an unmarked @keel/std-* name, else undefined", () => {
    fc.assert(
      fc.property(scoped, fc.constantFrom("library", "app", undefined, 1), (name, keel) => {
        const pkg = keel === undefined ? { name } : { name, keel };
        const want = keel === "library" ? "library" : /^@keel\/std-[a-z0-9-]+$/.test(name) ? "std" : undefined;
        expect(libraryKind(pkg, name)).toBe(want);
      }),
      { seed: SEED, numRuns: 60 },
    );
    expect(libraryKind({ keel: "library" }, "charts")).toBeUndefined();
    expect(libraryKind(undefined, "@keel/std-jobs")).toBe("std");
    expect(libraryKind({ keel: "library" }, "@keel/std-jobs")).toBe("library");
    expect(libraryKind(null, "@acme/charts")).toBeUndefined();
  });
});

describe("libraryFiles and the gates", () => {
  let root = "";
  const lib = (at: string, name: string, id: string, deps: readonly string[], extra: Record<string, unknown> = {}) => {
    const dir = path.join(at, "node_modules", name);
    fs.mkdirSync(path.join(dir, "src", "parts"), { recursive: true });
    fs.mkdirSync(path.join(dir, "unsafe"), { recursive: true });
    const exports = { ".": "./index.js", "./routes": "./routes.js" };
    fs.writeFileSync(
      path.join(dir, "package.json"),
      JSON.stringify({ name, type: "module", keel: "library", exports, ...extra }),
    );
    fs.writeFileSync(
      path.join(dir, "index.js"),
      `globalThis.__keelLib = [...(globalThis.__keelLib ?? []), '${name}'];\n`,
    );
    fs.writeFileSync(path.join(dir, "routes.js"), "export const routes = {}\n");
    fs.writeFileSync(path.join(dir, "module.ts"), `export default { id: '${id}', deps: ${JSON.stringify(deps)} }\n`);
    fs.writeFileSync(path.join(dir, "src", "index.ts"), "export {}\n");
    fs.writeFileSync(path.join(dir, "src", "parts", "A.tsx"), "export {}\n");
    fs.writeFileSync(path.join(dir, "unsafe", "u.ts"), "export {}\n");
    fs.writeFileSync(path.join(dir, "README.md"), "x\n");
    return fs.realpathSync(dir);
  };
  const app = (m: string, deps: readonly string[]) => ({
    path: `modules/${m}/module.ts`,
    source: `export default { id: '${m}', deps: ${JSON.stringify(deps)} }\n`,
  });
  beforeEach(() => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "keel-lib-")));
    Reflect.set(globalThis, "__keelLib", []);
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it("finds the listed libraries and, transitively, those their manifests list, with their src and unsafe files", () => {
    const charts = lib(root, "@acme/charts", "charts", ["@acme/other", "shop"]);
    const other = lib(root, "@acme/other", "other", []);
    fs.mkdirSync(path.join(root, "node_modules", "@acme", "plain"), { recursive: true });
    fs.writeFileSync(path.join(root, "node_modules", "@acme", "plain", "package.json"), '{"name":"@acme/plain"}');
    const found = libraryFiles(root, [app("shop", ["@acme/charts", "@acme/plain", "@acme/none", "catalog"])]);
    expect(found.map((l) => [l.name, l.dir, l.kind, l.id])).toEqual([
      ["@acme/charts", charts, "library", "charts"],
      ["@acme/other", other, "library", "other"],
    ]);
    expect(found[0]?.files).toEqual([
      path.join(charts, "src", "index.ts"),
      path.join(charts, "src", "parts", "A.tsx"),
      path.join(charts, "unsafe", "u.ts"),
    ]);
  });

  it("follows a linked library to its real path", () => {
    const outside = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "keel-lib-real-")));
    try {
      const real = lib(outside, "@acme/charts", "charts", []);
      fs.mkdirSync(path.join(root, "node_modules", "@acme"), { recursive: true });
      fs.symlinkSync(real, path.join(root, "node_modules", "@acme", "charts"));
      const found = libraryFiles(root, [app("shop", ["@acme/charts"])]);
      expect(found.map((l) => l.dir)).toEqual([real]);
      expect(found[0]?.files).toContain(path.join(real, "src", "index.ts"));
    } finally {
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });

  it("importDeps finds each library, transitively, never runs a library's entry, and reports E1159 for a package entry that is no library", async () => {
    lib(root, "@acme/charts", "charts", ["@acme/other", "@acme/gone"]);
    lib(root, "@acme/other", "other", []);
    fs.mkdirSync(path.join(root, "node_modules", "@acme", "plain"), { recursive: true });
    fs.writeFileSync(path.join(root, "node_modules", "@acme", "plain", "package.json"), '{"name":"@acme/plain"}');
    const diags = await importDeps(root, [app("shop", ["@acme/charts", "@acme/plain", "@acme/none", "catalog"])]);
    expect(diags.map((d) => `${d.code} ${d.path} ${d.message}`)).toEqual([
      "E1159 modules/shop/module.ts library dep @acme/plain of module shop cannot be imported (not a library)",
      "E1159 modules/shop/module.ts library dep @acme/none of module shop cannot be imported (not found)",
      "E1159 node_modules/@acme/charts/module.ts library dep @acme/gone of module charts cannot be imported (not found)",
    ]);
    // A library is imported only through its `./tools` (k.library-pack Package): neither entry ran.
    expect(Reflect.get(globalThis, "__keelLib")).toEqual([]);
  });

  it("stdPlacedExports finds a placed library's package by its manifest id", () => {
    lib(root, "@acme/charts", "charts", []);
    expect(stdPlacedExports(root, "charts", [app("shop", ["@acme/charts"])])).toEqual({
      name: "@acme/charts",
      contract: false,
      routes: true,
    });
    expect(stdPlacedExports(root, "charts", [app("shop", ["charts"])])).toBeUndefined();
  });
});

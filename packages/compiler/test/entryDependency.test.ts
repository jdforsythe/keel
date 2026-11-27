// An app need not list a kernel package only generated or tooling code imports: `@keel/store` and its subpaths resolve
// from the compiler (the client and server entries) or from the module the caller names (the CLI's surface evaluation).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tempDir } from "@keel/tooling/test-tmp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { entryDependency } from "../src/entry/entryDependency.ts";

const COMPILER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let app = "";

beforeEach(() => {
  app = fs.realpathSync(tempDir("keel-entry-dep-"));
  fs.writeFileSync(
    path.join(app, "package.json"),
    `${JSON.stringify({ name: "fx", private: true, type: "module" })}\n`,
  );
});
afterEach(() => fs.rmSync(app, { recursive: true, force: true }));

describe("entryDependency", () => {
  it("resolves @keel/store from the compiler for an app without @keel/store in its dependencies", () => {
    const file = entryDependency("@keel/store", app);
    expect(file).toBe(fs.realpathSync(path.join(COMPILER, "..", "store", "src", "index.ts")));
  });
  it("resolves a subpath, @keel/store/internal, from the compiler", () => {
    const file = entryDependency("@keel/store/internal", app);
    expect(file).toBe(fs.realpathSync(path.join(COMPILER, "..", "store", "src", "internal", "index.ts")));
  });
  it("resolves the internals the CLI's server-side surface evaluation loads from the CLI's dependencies", () => {
    const cli = pathToFileURL(path.join(COMPILER, "..", "cli", "src", "internal", "surfaceRun.ts")).href;
    expect(entryDependency("@keel/store/internal", app, cli)).toBe(
      fs.realpathSync(path.join(COMPILER, "..", "store", "src", "internal", "index.ts")),
    );
    expect(entryDependency("@keel/router/internal", app, cli)).toBe(
      fs.realpathSync(path.join(COMPILER, "..", "router", "src", "internal", "index.ts")),
    );
  });
  it("leaves a package the app resolves to Vite", () => {
    expect(entryDependency("@keel/store", COMPILER)).toBeUndefined();
    expect(entryDependency("@keel/store/internal", COMPILER)).toBeUndefined();
  });
  it("leaves a specifier outside @keel/ and one the compiler cannot resolve to Vite", () => {
    expect(entryDependency("vite", app)).toBeUndefined();
    expect(entryDependency("@keel/no-such-package", app)).toBeUndefined();
  });
});

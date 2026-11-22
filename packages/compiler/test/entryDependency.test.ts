// An app need not list a kernel package only the generated entry imports: `@keel/store` resolves from the compiler.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { entryDependency } from "../src/internal/entryDependency.ts";

const COMPILER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let app = "";

beforeEach(() => {
  app = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "keel-entry-dep-")));
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
  it("leaves a package the app resolves to Vite", () => {
    expect(entryDependency("@keel/store", COMPILER)).toBeUndefined();
  });
  it("leaves a specifier outside @keel/ and one the compiler cannot resolve to Vite", () => {
    expect(entryDependency("vite", app)).toBeUndefined();
    expect(entryDependency("@keel/no-such-package", app)).toBeUndefined();
  });
});

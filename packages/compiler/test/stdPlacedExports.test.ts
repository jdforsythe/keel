// k.topology Rules E1586: `stdPlacedExports` finds a placed stdlib module's package from the in-memory app manifests'
// `deps` and says which of `./contract` and `./routes` it resolves.
// Examples only: fixed packages in a temp dir. No random inputs (a fast-check seed would be 1337).
import fs from "node:fs";
import path from "node:path";
import { tempDir } from "@keel/tooling/test-tmp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { stdPlacedExports } from "../src/std/stdPlacedExports.ts";

let root = "";
const pkg = (id: string, exports: Record<string, string>, files: readonly string[]): void => {
  const dir = path.join(root, "node_modules", "@keel", `std-${id}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: `@keel/std-${id}`, exports }));
  fs.writeFileSync(path.join(dir, "module.ts"), `export default { id: '${id}', deps: [] }\n`);
  for (const f of files) fs.writeFileSync(path.join(dir, f), "export {}\n");
};
const app = (m: string, deps: readonly string[]) => ({
  path: `modules/${m}/module.ts`,
  source: `export default { id: '${m}', deps: [${deps.map((d) => `'${d}'`).join(", ")}] }\n`,
});

beforeAll(() => {
  root = tempDir(".tmp-std-placed-", import.meta.dirname);
  pkg("half", { "./module": "./module.ts", "./contract": "./contract.ts" }, ["contract.ts"]);
  pkg("gone", { "./contract": "./contract.ts", "./routes": "./routes.ts" }, ["contract.ts"]);
  pkg("full", { "./contract": "./contract.ts", "./routes": "./routes.ts" }, ["contract.ts", "routes.ts"]);
  pkg("jobs", { "./module": "./module.ts" }, []);
});
afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

describe("stdPlacedExports", () => {
  it("reports each export the package resolves, a named file that is missing resolving nothing", () => {
    const files = [app("a", ["@keel/std-half", "@keel/std-gone", "@keel/std-full", "@keel/std-jobs"])];
    expect(stdPlacedExports(root, "half", files)).toEqual({ name: "@keel/std-half", contract: true, routes: false });
    expect(stdPlacedExports(root, "gone", files)).toEqual({ name: "@keel/std-gone", contract: true, routes: false });
    expect(stdPlacedExports(root, "full", files)).toEqual({ name: "@keel/std-full", contract: true, routes: true });
    expect(stdPlacedExports(root, "jobs", files)).toEqual({ name: "@keel/std-jobs", contract: false, routes: false });
  });

  it("is undefined for an app module, a package no manifest names, and a non-stdlib dep", () => {
    expect(stdPlacedExports(root, "half", [app("a", ["@keel/std-half"]), app("half", [])])).toBeUndefined();
    expect(stdPlacedExports(root, "half", [app("a", ["@keel/std-full"])])).toBeUndefined();
    expect(stdPlacedExports(root, "half", [app("a", ["half"])])).toBeUndefined();
  });
});

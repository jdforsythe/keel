// k.check-cache and k.library In an app: a library's files and the `keel` condition its `package.json` names are part of
// what a type pass depends on, so a changed library is never answered from a stale entry, in memory or on disk.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tempDir } from "@keel/tooling/test-tmp";
import { afterEach, beforeEach, expect, it } from "vitest";
import { check } from "../src/index.ts";

let root = "";
let cache = "";
beforeEach(() => {
  root = tempDir("keel-library-cache-");
  writeFileSync(join(root, "package.json"), "{}");
  cache = join(root, "node_modules", ".cache", "keel");
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const LIB = "node_modules/@acme/charts";
const pkg = (entry: string): string =>
  JSON.stringify({
    name: "@acme/charts",
    version: "1.0.0",
    type: "module",
    keel: "library",
    exports: { ".": { keel: entry, default: "./index.js" } },
  });

/** The project as `keel check` reads it, written to disk too: the app's `shop` reads `n` from the library as a number. */
function project(entry: string, index: string): { path: string; source: string }[] {
  const files = [
    {
      path: "modules/shop/module.ts",
      source:
        "import { module } from '@keel/compiler'\nexport default module({ id: 'shop', deps: ['@acme/charts'], capabilities: [], public: { exports: [] } })\n",
    },
    { path: "modules/shop/use.ts", source: "import { n } from '@acme/charts'\nexport const total: number = n\n" },
    { path: `${LIB}/package.json`, source: pkg(entry) },
    {
      path: `${LIB}/module.ts`,
      source:
        "import { module } from '@keel/compiler'\nexport default module({ id: 'charts', deps: [], capabilities: [], public: { exports: ['n'] } })\n",
    },
    { path: `${LIB}/src/index.ts`, source: index },
    { path: `${LIB}/src/text.ts`, source: "export const n = 'a'\n" },
  ];
  for (const f of files) {
    mkdirSync(dirname(join(root, f.path)), { recursive: true });
    writeFileSync(join(root, f.path), f.source);
  }
  return files;
}

/** E1751s but the manifests' unresolved `@keel/compiler` (no kernel is installed under the temporary root). */
const typeDiags = (files: { path: string; source: string }[]) =>
  check(files, { root, typeCache: cache, project: files }).diagnostics.filter(
    (d) => d.code === "E1751" && !d.message.includes("'@keel/compiler'"),
  );
const typeErrors = (files: { path: string; source: string }[]): string[] => typeDiags(files).map((d) => d.path);

it("a changed library file changes the type pass's answer, back and forth, with the cache kept", () => {
  expect(typeErrors(project("./src/index.ts", "export const n = 1\n"))).toEqual([]);
  expect(typeErrors(project("./src/index.ts", "export const n = 'a'\n"))).toEqual(["modules/shop/use.ts"]);
  expect(typeErrors(project("./src/index.ts", "export const n = 1\n"))).toEqual([]);
});

it("the `keel` condition's target is read: pointing it at another source changes the answer", () => {
  expect(typeErrors(project("./src/index.ts", "export const n = 1\n"))).toEqual([]);
  expect(typeErrors(project("./src/text.ts", "export const n = 1\n"))).toEqual(["modules/shop/use.ts"]);
  expect(typeErrors(project("./src/index.ts", "export const n = 1\n"))).toEqual([]);
});

it("a type error inside a library file is the app's, located where the file lies, with no fix", () => {
  const files = project("./src/index.ts", "export const n: number = 'a'\n");
  const d = typeDiags(files);
  expect(d.map((x) => [x.path, x.fix])).toEqual([[`${LIB}/src/index.ts`, undefined]]);
});

// k.library-pack Own folder: the own-folder reading takes `module.ts`, `src/`, `unsafe/`, `test/` and the root
// `tokens.ts`; any other code file of the folder (a `conformance/` suite, a tool's script) is not read.
import { expect, test } from "vitest";
import { asInstalled } from "../src/internal/asInstalled.ts";

const file = (path: string) => ({ path, source: "export const a = 1;\n" });

test("the own folder's module, code, unsafe code and tests are read where an app holds them installed", () => {
  const v = asInstalled("@x/lib", "{}", [
    file("module.ts"),
    file("src/a.ts"),
    file("unsafe/b.ts"),
    file("test/a.test.ts"),
    file("tokens.ts"),
  ]);
  expect(v.files.map((f) => f.path)).toEqual([
    "node_modules/@x/lib/package.json",
    "node_modules/@x/lib/module.ts",
    "node_modules/@x/lib/src/a.ts",
    "node_modules/@x/lib/unsafe/b.ts",
    "node_modules/@x/lib/test/a.test.ts",
    "tokens.ts",
  ]);
});

test("a conformance suite, a tool's script and a configuration file are not read; files that are no code stay", () => {
  const v = asInstalled("@x/lib", "{}", [
    file("conformance/a.test.ts"),
    file("conformance/fixtures.ts"),
    file("scripts/x.mjs"),
    file("vitest.config.ts"),
    file("tsconfig.json"),
    file(".keel/ledger.json"),
  ]);
  expect(v.files.map((f) => f.path)).toEqual([
    "node_modules/@x/lib/package.json",
    "tsconfig.json",
    ".keel/ledger.json",
  ]);
});

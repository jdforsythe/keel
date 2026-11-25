// Seed 1337 (no generated inputs: the clause is about fixed project files)
// Spec: k.bundle, Conformance "With no type reference, a page reading `import.meta.env.MODE` and `DEV` and importing `./w.ts?worker` and `./a.svg?url` checks clean; `import.meta.env.VITE_X` is one E1751; with `/// <reference types=\"vite/client\" />` as its first line, the page reports one E1016 at line 1, col 1 and the same E1751."
// Spec: k.bundle, Types "`@keel/compiler/client` declares what a browser build promises: `import.meta.env` as `{ BASE_URL: string; MODE: string; DEV, PROD, SSR: boolean }` (k.boundary Environment), any other key a type error, and the default import of `*?worker` and `*?sharedworker` (a `Worker` or `SharedWorker` constructor) and of `*?url` (a `string`). `keel check` loads it when it resolves from the project root, and the scaffold's `tsconfig.json` lists it in `types` beside `node`; app code writes no reference. Any other declaration of `import.meta` types, a type reference among them, is E1016 (k.boundary Ambient types)."
// Spec: k.check, Pipeline step 1 "Ambient types: Node's when `@types/node` resolves from the project root, and k.bundle's Types."
// The project is a temporary root whose `node_modules` resolves `@keel/compiler`, `vite` and `@types/node` (symlinks to the workspace's copies).
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { check } from "@keel/check";
import { afterAll, beforeAll, expect, test } from "vitest";
import { one } from "./support.ts";

const HERE = import.meta.dirname;
const COMPILER = realpathSync(join(HERE, "..", "..", "compiler"));
const requireFrom = (dir: string) => createRequire(join(dir, "package.json"));
const VITE = dirname(requireFrom(COMPILER).resolve("vite/package.json"));
const NODE_TYPES = realpathSync(join(HERE, "..", "node_modules", "@types", "node"));

let root = "";
beforeAll(() => {
  root = mkdtempSync(join(realpathSync(tmpdir()), "keel-client-types-"));
  mkdirSync(join(root, "node_modules", "@keel"), { recursive: true });
  mkdirSync(join(root, "node_modules", "@types"), { recursive: true });
  symlinkSync(COMPILER, join(root, "node_modules", "@keel", "compiler"));
  symlinkSync(VITE, join(root, "node_modules", "vite"));
  symlinkSync(NODE_TYPES, join(root, "node_modules", "@types", "node"));
});
afterAll(() => {
  if (root !== "") rmSync(root, { recursive: true, force: true });
});

const REF = '/// <reference types="vite/client" />\n';
const GOOD =
  "import Sum from './w.ts?worker'\nimport src from './a.svg?url'\nexport const mode: string = import.meta.env.MODE\nexport const dev: boolean = import.meta.env.DEV\nexport const w: Worker = new Sum({ name: 'sum' })\nexport const u: string = src\n";
const BAD = "export const x = import.meta.env.VITE_X\n";
const W = { path: "w.ts", source: "export const w = 1\n" };
const diagsOf = (source: string, code: string) =>
  check([...one(source, "page.ts"), W], { root }).diagnostics.filter((d) => d.code === code);
const e1751 = (source: string) => diagsOf(source, "E1751");
const e1016 = (source: string) => diagsOf(source, "E1016");

test("With no type reference, a page reading `import.meta.env.MODE` and `DEV` and importing `./w.ts?worker` and `./a.svg?url` checks clean", () => {
  expect(e1751(GOOD)).toEqual([]);
  expect(e1016(GOOD)).toEqual([]);
});

test("`import.meta.env.VITE_X` with no type reference is one E1751", () => {
  const d = e1751(BAD);
  expect(d).toHaveLength(1);
  expect(d[0]?.line).toBe(1);
  expect(e1016(BAD)).toEqual([]);
});

test('`import.meta.env.VITE_X` with `/// <reference types="vite/client" />` as its first line reports one E1016 at line 1, col 1 and the same E1751', () => {
  const ref = e1016(REF + BAD);
  expect(ref).toHaveLength(1);
  expect([ref[0]?.line, ref[0]?.col]).toEqual([1, 1]);
  const d = e1751(REF + BAD);
  expect(d).toHaveLength(1);
  expect(d[0]?.line).toBe(2);
});

test('the clean page with `/// <reference types="vite/client" />` as its first line reports one E1016 at line 1, col 1 and no E1751', () => {
  const ref = e1016(REF + GOOD);
  expect(ref).toHaveLength(1);
  expect([ref[0]?.line, ref[0]?.col]).toEqual([1, 1]);
  expect(e1751(REF + GOOD)).toEqual([]);
});

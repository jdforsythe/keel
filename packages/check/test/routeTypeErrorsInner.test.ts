// k.routes Where rules fire: a type error maps to E1510, E1506 or E1515 only at a key, a member's literal or name
// value, or the argument; inside a function body or a nested call (a schema expression) it is E1751 with its own text.
import path from "node:path";
import { repoRoot } from "@keel/tooling/repo-root";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { check } from "../src/check.ts";
import type { Diagnostic, SourceFile } from "../src/index.ts";

const ROOT = path.join(repoRoot(import.meta.dirname), "packages", "router", path.sep);
const CONTRACT = "modules/a/a.contract.ts";
const ROUTES = "modules/a/routes.ts";
const contract = (entries: string): SourceFile => ({
  path: CONTRACT,
  source: `import { contract } from '@keel/router/contract'\nimport { s } from '@keel/schema'\nexport const a = contract('a', {\n${entries}\n})\n`,
});
const routes = (binding: string): SourceFile => ({
  path: ROUTES,
  source: `import { manifest, guard, loader } from '@keel/router'\nimport { ok } from '@keel/schema'\nimport { s } from '@keel/schema'\nimport { a } from './a.contract.ts'\ndeclare const Page: () => Node\nexport const routes = manifest(a, {\n${binding}\n})\n`,
});
const MODULE: SourceFile = {
  path: "modules/a/module.ts",
  source:
    "import { module } from '@keel/compiler'\nexport default module({ id: 'a', deps: [], capabilities: [], public: { exports: [] } })\n",
};
const typed = (files: readonly SourceFile[]): readonly Diagnostic[] => check(files, { root: ROOT }).diagnostics;
const codes = (ds: readonly Diagnostic[]): string[] => ds.map((d) => `${d.code} ${d.message.split(" ")[0] ?? ""}`);

describe("a type error inside a contract member's expression", () => {
  const SCHEMA: Readonly<Record<string, string>> = {
    params: "  'a.x': { path: '/x/:id', params: s.object({ id: s.nope() }) },",
    search: "  'a.x': { path: '/x', search: s.object({ q: s.nope() }) },",
    query: "  'a.x': { method: 'GET', path: '/x', query: s.object({ q: s.nope() }), output: s.json() },",
    body: "  'a.x': { method: 'POST', path: '/x', body: s.object({ q: s.nope() }), output: s.json() },",
    output: "  'a.x': { method: 'GET', path: '/x', output: s.object({ q: s.nope() }) },",
  };
  it("is E1751 with TypeScript's code and text for every schema member", () => {
    fc.assert(
      fc.property(fc.constantFrom(...Object.keys(SCHEMA)), (member) => {
        const ds = typed([contract(SCHEMA[member] ?? "")]);
        expect(codes(ds)).toEqual(["E1751 TS2339"]);
        expect(ds[0]?.message).toContain("'nope'");
      }),
      { seed: 4242, numRuns: 10 },
    );
  });

  it("under a key without the module prefix, the key is E1155 and the inner error is E1751", () => {
    const ds = typed([MODULE, contract("  'b.x': { path: '/x/:id', params: s.object({ id: s.nope() }) },")]);
    expect(codes(ds).sort()).toEqual(["E1155 route", "E1751 TS2339"]);
  });
});

describe("a type error inside an inline binding function", () => {
  const ENTRIES = "  'a.home': { path: '/' },\n  'a.get': { method: 'GET', path: '/api/get', output: s.json() },";
  const files = (binding: string): SourceFile[] => [contract(ENTRIES), routes(binding)];
  const noise = (ds: readonly Diagnostic[]): readonly Diagnostic[] =>
    ds.filter((d) => d.code !== "E1551" && d.code !== "E1009");
  const BODY: Readonly<Record<string, string>> = {
    component: "  'a.home': { component: () => { const n: number = 'x'; return Page() } },",
    title: "  'a.home': { component: Page, title: () => { const n: number = 'x'; return 'x' } },",
    guard:
      "  'a.home': { component: Page, guard: guard({ redirect: 'a.home' }, async () => { const n: number = 'x'; return ok(null) }) },",
  };
  it("is E1751 with TypeScript's code, not E1510 or E1515", () => {
    fc.assert(
      fc.property(fc.constantFrom(...Object.keys(BODY)), (member) => {
        const ds = noise(
          typed(
            files(
              `${BODY[member] ?? ""}\n  'a.get': { loader: loader(a, 'a.get', {}, async () => { const n: number = 'x'; return ok({}) }) },`,
            ),
          ),
        );
        expect(codes(ds)).toEqual(["E1751 TS2322", "E1751 TS2322"]);
      }),
      { seed: 4243, numRuns: 10 },
    );
  });

  it("a `layout` literal naming no layout is still E1506", () => {
    const ds = noise(
      typed(
        files(
          "  'a.home': { component: Page, layout: 'a.nope' },\n  'a.get': { loader: loader(a, 'a.get', {}, async () => ok({})) },",
        ),
      ),
    );
    expect(codes(ds)).toEqual(["E1506 a.home:"]);
  });

  it("a guard without `redirect`, an error at the member's key, is still E1515", () => {
    const ds = noise(
      typed(
        files(
          "  'a.home': { component: Page, guard: guard({}, async () => ok(null)) },\n  'a.get': { loader: loader(a, 'a.get', {}, async () => ok({})) },",
        ),
      ),
    );
    expect(codes(ds)).toEqual(["E1515 a.home:"]);
  });
});

// k.routes Where rules fire: a type error inside a `contract` or `manifest` argument is coded by its position alone,
// E1510, E1506 or E1515, never E1751; a fix removes a refused member or an extra binding key.
import path from "node:path";
import { repoRoot } from "@keel/tooling/repo-root";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { check } from "../src/check.ts";
import type { Diagnostic, SourceFile } from "../src/index.ts";
import { applyPatch } from "./support/applyPatch.ts";

/** A directory `@keel/router` resolves from, so the contract's and binding's types are checked. */
const ROOT = path.join(repoRoot(import.meta.dirname), "packages", "router", path.sep);
const CONTRACT = "modules/a/a.contract.ts";
const ROUTES = "modules/a/routes.ts";
const contract = (entries: string): SourceFile => ({
  path: CONTRACT,
  source: `import { contract } from '@keel/router/contract'\nimport { s } from '@keel/schema'\nexport const a = contract('a', {\n${entries}\n})\n`,
});
const routes = (binding: string): SourceFile => ({
  path: ROUTES,
  source: `import { manifest } from '@keel/router'\nimport { a } from './a.contract.ts'\nimport { load } from './load.server.ts'\ndeclare const Page: () => Node\nexport const routes = manifest(a, {\n${binding}\n})\n`,
});
const LOAD: SourceFile = {
  path: "modules/a/load.server.ts",
  source:
    "import { loader } from '@keel/router'\nimport { ok } from '@keel/schema'\nimport { a } from './a.contract.ts'\nexport const load = loader(a, 'a.get', {}, async () => ok({}))\n",
};
const ENTRIES = "  'a.home': { path: '/' },\n  'a.get': { method: 'GET', path: '/api/get', output: s.json() },";
const typed = (files: readonly SourceFile[]): readonly Diagnostic[] => check(files, { root: ROOT }).diagnostics;
const brief = (ds: readonly Diagnostic[]): string[] =>
  ds.map((d) => `${d.code} ${d.path}:${d.line}:${d.col} ${d.message}`);

describe("a type error inside a contract's entries", () => {
  it("a page with `output` is E1510 at `output` whose fix removes it, and the fixed source checks clean", () => {
    const file = contract("  'a.x': { path: '/x', output: s.json() },");
    const [d, ...rest] = typed([file]);
    expect(rest).toEqual([]);
    expect([d?.code, d?.see, d?.line, d?.message]).toEqual([
      "E1510",
      "k.contract",
      4,
      "a.x: a page entry has no output",
    ]);
    const after = applyPatch(CONTRACT, file.source, d?.fix ?? "");
    expect(after).toContain("  'a.x': { path: '/x' },\n");
    expect(typed([{ path: CONTRACT, source: after }])).toEqual([]);
  });

  it("an API entry without `output` is E1510 with no fix", () => {
    const ds = typed([contract("  'a.x': { method: 'GET', path: '/x' },")]);
    expect(ds.map((d) => [d.code, d.fix])).toEqual([["E1510", undefined]]);
  });

  it("an unprefixed key is no type-mapped diagnostic: the module pass reports its E1155", () => {
    const ds = typed([contract("  'b.x': { path: '/x' },")]);
    expect(ds.filter((d) => d.code === "E1751" || d.code === "E1510")).toEqual([]);
  });
});

describe("a type error inside a manifest binding", () => {
  const files = (binding: string): SourceFile[] => [contract(ENTRIES), LOAD, routes(binding)];

  it("a complete binding checks clean", () => {
    expect(typed(files("  'a.home': { component: Page },\n  'a.get': { loader: load },"))).toEqual([]);
  });

  it("an unbound entry is one E1515 at the argument naming it, with no fix", () => {
    const ds = typed(files("  'a.home': { component: Page },"));
    expect(brief(ds)).toEqual([`E1515 ${ROUTES}:5:35 the binding misses a.get; bind each contract entry`]);
    expect(ds[0]?.fix).toBeUndefined();
  });

  it("an extra key is one E1515 at the key whose fix removes it, and the fixed source checks clean", () => {
    const binding = "  'a.home': { component: Page },\n  'a.get': { loader: load },\n  'a.z': { component: Page },";
    const all = files(binding);
    const [d, ...rest] = typed(all);
    expect(rest).toEqual([]);
    expect([d?.code, d?.line, d?.message]).toEqual(["E1515", 8, "a.z is no entry of the contract; remove it"]);
    const source = applyPatch(ROUTES, routes(binding).source, d?.fix ?? "");
    expect(typed([contract(ENTRIES), LOAD, { path: ROUTES, source }])).toEqual([]);
  });

  it("an unknown `layout` is E1506 at `layout`", () => {
    const ds = typed(files("  'a.home': { component: Page, layout: 'a.nope' },\n  'a.get': { loader: load },"));
    expect(ds.map((d) => [d.code, d.see, d.line])).toEqual([["E1506", "k.routes", 6]]);
  });

  it("a page entry without `component` is E1515 at its key naming the member", () => {
    const ds = typed(files("  'a.home': {},\n  'a.get': { loader: load },"));
    expect(brief(ds)).toEqual([`E1515 ${ROUTES}:6:3 a.home: the binding needs component`]);
  });

  it("names the one refused member of an API GET binding, and its fix leaves the binding clean", () => {
    const value: Readonly<Record<string, string>> = {
      component: "Page",
      errorElement: "Page",
      title: "() => 'x'",
      action: "load",
      POST: "load",
    };
    fc.assert(
      fc.property(fc.constantFrom(...Object.keys(value)), fc.boolean(), (member, first) => {
        const parts = [`${member}: ${value[member]}`, "loader: load"];
        const binding = `  'a.home': { component: Page },\n  'a.get': { ${(first ? parts : parts.reverse()).join(", ")} },`;
        const ds = typed(files(binding));
        expect(ds.map((d) => [d.code, d.line, d.message])).toEqual([
          ["E1510", 7, `a.get: an API GET binding has no ${member}`],
        ]);
        const source = applyPatch(ROUTES, routes(binding).source, ds[0]?.fix ?? "");
        expect(source).toContain("  'a.get': { loader: load },");
      }),
      { seed: 1337, numRuns: 10 },
    );
  });

  it("a handler whose answer fails its entry's `output`, outside the arguments, is E1751 in its file", () => {
    const bad = LOAD;
    const entries =
      "  'a.home': { path: '/' },\n  'a.get': { method: 'GET', path: '/api/get', output: s.object({ n: s.number() }) },";
    const ds = typed([
      contract(entries),
      bad,
      routes("  'a.home': { component: Page },\n  'a.get': { loader: load },"),
    ]);
    expect(ds.filter((d) => d.code === "E1751").map((d) => d.path)).toEqual(["modules/a/load.server.ts"]);
  });

  it("with types off nothing is reported", () => {
    expect(check(files("  'a.home': {},"), { types: false }).diagnostics).toEqual([]);
  });
});

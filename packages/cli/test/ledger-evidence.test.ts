// Ledger evidence (k.testing Ledger): what a test body reaches and the evidence it gives (testFacts, testEvidence),
// the mutation-score reader, and the `ledger` file scope of readProject.
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { mutationClaims } from "../src/internal/mutationClaims.ts";
import { readProject } from "../src/internal/readProject.ts";
import { testEvidence } from "../src/internal/testEvidence.ts";
import { testFacts } from "../src/internal/testFacts.ts";

const file = (path: string, source: string) => ({ path, source });
const T = "packages/a/test/t.test.ts";
/** Names reached by each test of one test file. */
const reached = (source: string, extra: { path: string; source: string }[] = [], path = T): string[][] =>
  testEvidence([file(path, source), ...extra]).map((r) => [...r.names].sort());
/** Evidence of each test of one test file. */
const evidence = (source: string, extra: { path: string; source: string }[] = []) =>
  testEvidence([file(T, source), ...extra]).map((r) => r.ev);
const FC = 'import fc from "fast-check";\n';
const EX = { kind: "example", passed: true };

describe("testFacts / testEvidence: references", () => {
  it("an imported binding counts by its imported name, used or called; type-only imports do not", () => {
    const src = [
      'import { foo as f, bar, type T } from "x";',
      'import type { U } from "y";',
      'it("t", () => { expect(f).toBeDefined(); const v: T = 1; const w: U = 2; bar; });',
    ].join("\n");
    expect(reached(src)).toEqual([["bar", "expect", "foo", "toBeDefined"]]);
  });

  it("an import used by the body is credited; one shadowed by a local of its name, or never used, is not", () => {
    const used = 'import { addUser } from "x";\nit("t", () => { addUser(1); });';
    expect(reached(used)).toEqual([["addUser"]]);
    const shadow = 'import { addUser } from "x";\nit("t", () => { const { addUser } = fresh(); addUser(1); });';
    expect(reached(shadow)).toEqual([["fresh"]]);
    const unused = 'import { addUser } from "x";\nit("t", () => { expect(1).toBe(1); });';
    expect(reached(unused)).toEqual([["expect", "toBe"]]);
    const param = 'import { f } from "x";\nit("t", () => { [1].map((f) => f(2)); f(3); });';
    expect(reached(param)).toEqual([["f", "map"].sort()]);
    const inner = 'import { f } from "x";\nit("t", () => { { const f = g; f(); } for (const f of h) f(); });';
    expect(reached(inner)).toEqual([[]]);
  });

  it("an import named only in a type position earns no credit", () => {
    const src = 'import { User } from "x";\nit("t", () => { const u: User = make(); type V = typeof User; });';
    expect(reached(src)).toEqual([["make"]]);
  });

  it("a namespace member counts; any call or new by name counts, a plain member read does not", () => {
    const src = [
      'import * as m from "x";',
      'it("t", () => { m.one; obj.two(); three(); new Four(); obj.five; });',
    ].join("\n");
    expect(reached(src)).toEqual([["Four", "one", "three", "two"]]);
  });

  it("a JSX tag counts; a default import that resolves to no known file counts by its module's basename", () => {
    const src = ['import View from "../modules/x/Page.view.tsx";', 'it("t", () => { render(<Card />, View); });'].join(
      "\n",
    );
    expect(reached(src, [], "packages/a/test/t.test.tsx")).toEqual([["Card", "Page", "render"]]);
  });

  it("declarations, keys and labels are not references", () => {
    const src = [
      'import { foo, bar, baz, qux } from "x";',
      'it("t", () => { const foo = 1; const { bar: b } = o; const { baz } = o; ({ qux: 1 }); function f(foo) {} lbl: for (;;) break lbl; });',
    ].join("\n");
    expect(reached(src)).toEqual([[]]);
  });

  it("shorthand properties are references", () => {
    expect(reached('import { foo } from "x";\nit("t", () => ({ foo }));')).toEqual([["foo"]]);
  });

  it("comments and strings never reach a name", () => {
    expect(reached('it("foo()", () => { // foo()\n /* foo() */ "foo()"; `foo()`; });')).toEqual([[]]);
  });

  it("skipped, todo, failing-by-design and bodiless tests give no evidence; suites pass skipping down", () => {
    const src = [
      'it.skip("a", () => a());',
      'it.todo("b");',
      'it.fails("c", () => c());',
      'xit("d", () => d());',
      'xtest("e", () => e());',
      'test.skip.each([1])("f", () => f());',
      'describe.skip("s", () => { it("g", () => g()); describe("n", () => it("h", () => h())); });',
      'xdescribe("s", () => it("i", () => i()));',
      'describe.todo("s", () => it("j", () => j()));',
      'it("bodiless");',
      'test.addNote("k", () => k());',
      'other("l", () => l());',
    ].join("\n");
    expect(reached(src)).toEqual([]);
  });

  it("run tests: plain, only, concurrent, each (with its table), skipIf, runIf, nested suites, named body", () => {
    const src = [
      'it("a", () => a());',
      'test.only("b", function () { b(); });',
      'it.concurrent("c", async () => c());',
      'it.each([[d]])("d", (x) => x());',
      'it.skipIf(cond)("e", () => e());',
      'test.runIf(cond)("f", () => f());',
      'describe("s", () => { describe.each([1])("n", () => { it("g", () => g()); }); });',
      "function named() { h(); }",
      'suite("s", () => { it("h", named); });',
      "for (const c of cs) it(c, () => i());",
    ].join("\n");
    expect(reached(src).map((n) => n.join())).toEqual(["a", "b", "c", "x", "e", "f", "g", "h", "i"]);
  });

  it("helpers: own top-level functions and relative imports, transitively, once each; packages are not followed", () => {
    const fixtures = file(
      "packages/a/test/fixtures.ts",
      [
        'import { deep } from "../src/deep.ts";',
        "export function build() { return deep(); }",
        "export const loop = () => loop();",
      ].join("\n"),
    );
    const src = [
      'import { build, loop } from "./fixtures.ts";',
      'import { remote } from "pkg";',
      "function setup() { return mid(); }",
      "const mid = () => inner();",
      "const inner = function () { return { x: 1 }; };",
      "const notFn = 3;",
      'it("t", () => { setup(); build(); loop(); remote(); notFn; missing(); });',
    ].join("\n");
    expect(reached(src, [fixtures])).toEqual([["deep", "inner", "loop", "mid", "missing", "remote", "setup"]]);
  });

  it("a relative import pins its names to the file it resolves to among the known files; others stay by name", () => {
    const src = [
      'import { board } from "../src/api/board.ts";',
      'import { other } from "../src/missing.ts";',
      'it("t", () => { board(); other(); });',
    ].join("\n");
    const [ref] = testEvidence([file(T, src)], new Set(["packages/a/src/api/board.ts"]));
    expect([...(ref?.pinned ?? [])]).toEqual(["packages/a/src/api/board.ts#board"]);
    expect([...(ref?.names ?? [])]).toEqual(["other"]);
  });

  it("only *.test.* files give tests; helper files with it(...) do not", () => {
    expect(reached('it("t", () => a());', [], "packages/a/test/helpers.ts")).toEqual([]);
  });

  it("parses .tsx, .js and .mjs files", () => {
    for (const p of ["packages/a/test/t.test.tsx", "packages/a/test/t.test.js", "packages/a/test/t.test.mjs"])
      expect(reached('it("t", () => a());', [], p)).toEqual([["a"]]);
  });
});

describe("testFacts / testEvidence: property runs", () => {
  it("a body without a property run is an example", () => {
    expect(evidence('it("t", () => a());')).toEqual([EX]);
  });

  it("fc.assert / fc.check with literal options; default 100 runs and no seed", () => {
    expect(
      evidence(
        `${FC}it("a", () => fc.assert(p, { seed: 7, numRuns: 1_000 }));\nit("b", () => fc.check(p));\nit("c", () => fc.assert(p, { "numRuns": 5, seed: -1 }));`,
      ),
    ).toEqual([
      { kind: "property", passed: true, runs: 1000, seed: 7 },
      { kind: "property", passed: true, runs: 100 },
      { kind: "property", passed: true, runs: 5, seed: -1 },
    ]);
  });

  it("namespace and named fast-check imports; another module's assert is not a property", () => {
    expect(
      evidence(
        'import * as fc from "fast-check";\nimport { assert } from "fast-check";\nimport { check } from "other";\nit("a", () => fc.assert(p, { seed: 1 }));\nit("b", () => assert(p, { seed: 2 }));\nit("c", () => check(p, { seed: 3 }));\nit("d", () => other.assert(p, { seed: 4 }));',
      ),
    ).toEqual([
      { kind: "property", passed: true, runs: 100, seed: 1 },
      { kind: "property", passed: true, runs: 100, seed: 2 },
      EX,
      EX,
    ]);
  });

  it("the strongest run wins: seeded over unseeded, then more runs", () => {
    expect(
      evidence(
        `${FC}it("t", () => { fc.assert(p, { numRuns: 900 }); fc.assert(p, { seed: 1, numRuns: 10 }); fc.assert(p, { seed: 2, numRuns: 200 }); fc.assert(p, { seed: 3, numRuns: 150 }); });`,
      ),
    ).toEqual([{ kind: "property", passed: true, runs: 200, seed: 2 }]);
  });

  it("constants resolve: local, conditional (smaller arm), wrapped; unknown values are omitted", () => {
    const src = [
      FC,
      "const SEED = 1337;",
      "const RUNS = process.env.X === undefined ? 100 : 15;",
      "const BIG = (300 as const);",
      "const NEG = -(2);",
      "const ODD = -x;",
      'it("a", () => fc.assert(p, { seed: SEED, numRuns: RUNS }));',
      'it("b", () => fc.assert(p, { seed: NEG, numRuns: BIG }));',
      'it("c", () => fc.assert(p, { seed: ODD, numRuns: compute() }));',
      'it("d", () => fc.assert(p, { seed: UNKNOWN, numRuns: c ? n : 2 }));',
      "const seed = 9;",
      'it("e", () => fc.assert(p, { seed, numRuns: 100 satisfies number }));',
    ].join("\n");
    expect(evidence(src)).toEqual([
      { kind: "property", passed: true, runs: 15, seed: 1337 },
      { kind: "property", passed: true, runs: 300, seed: -2 },
      { kind: "property", passed: true },
      { kind: "property", passed: true },
      { kind: "property", passed: true, runs: 100, seed: 9 },
    ]);
  });

  it("options objects: local, spread, imported (with defaults for absent keys); unreadable ones are unknown", () => {
    const fixtures = file(
      "packages/a/test/fixtures.ts",
      [
        'import { BASE } from "./base.ts";',
        "export const SEED = BASE;",
        "export const RUNS = 200;",
        "export const opts = { seed: SEED, numRuns: RUNS };",
        "export const seedOnly = { seed: 5 };",
        "export const bad = { ...elsewhere };",
      ].join("\n"),
    );
    const baseFile = file("packages/a/test/base.ts", "export const BASE = 42;\n");
    const src = [
      FC,
      'import { SEED, RUNS, opts, seedOnly, bad, nothing } from "./fixtures.ts";',
      'import { far } from "pkg";',
      "const local = { seed: 3, numRuns: 120 };",
      "const spread = { ...local, numRuns: 130 };",
      "const loopy = { ...loopy };",
      'it("a", () => fc.assert(p, opts));',
      'it("b", () => fc.assert(p, seedOnly));',
      'it("c", () => fc.assert(p, local));',
      'it("d", () => fc.assert(p, spread));',
      'it("e", () => fc.assert(p, { seed: SEED, numRuns: RUNS }));',
      'it("f", () => fc.assert(p, bad));',
      'it("g", () => fc.assert(p, nothing));',
      'it("h", () => fc.assert(p, far));',
      'it("i", () => fc.assert(p, param));',
      'it("j", () => fc.assert(p, loopy));',
      'it("k", () => fc.assert(p, make()));',
    ].join("\n");
    expect(evidence(src, [fixtures, baseFile])).toEqual([
      { kind: "property", passed: true, runs: 200, seed: 42 },
      { kind: "property", passed: true, runs: 100, seed: 5 },
      { kind: "property", passed: true, runs: 120, seed: 3 },
      { kind: "property", passed: true, runs: 130, seed: 3 },
      { kind: "property", passed: true, runs: 200, seed: 42 },
      { kind: "property", passed: true },
      { kind: "property", passed: true },
      { kind: "property", passed: true },
      { kind: "property", passed: true },
      { kind: "property", passed: true },
      { kind: "property", passed: true },
    ]);
  });

  it("fc.configureGlobal sets the defaults; an unreadable one makes them unknown", () => {
    expect(evidence(`${FC}fc.configureGlobal({ seed: 11, numRuns: 400 });\nit("t", () => fc.assert(p));`)).toEqual([
      { kind: "property", passed: true, runs: 400, seed: 11 },
    ]);
    expect(evidence(`${FC}fc.configureGlobal({ seed: 11 });\nit("t", () => fc.assert(p, { numRuns: 7 }));`)).toEqual([
      { kind: "property", passed: true, runs: 7, seed: 11 },
    ]);
    expect(evidence(`${FC}fc.configureGlobal(cfg);\nit("t", () => fc.assert(p));`)).toEqual([
      { kind: "property", passed: true },
    ]);
    expect(evidence(`${FC}other.configureGlobal({ seed: 1 });\nit("t", () => fc.assert(p));`)).toEqual([
      { kind: "property", passed: true, runs: 100 },
    ]);
  });

  it("properties(...) from @keel/testing is a property run: 100 runs and seed 1337 unless given; an unimported one is not", () => {
    const src = [
      'import { properties, properties as props } from "@keel/testing";',
      'it("a", () => properties(X));',
      'it("b", () => props(X, { runs: 50, seed: 3 }));',
    ].join("\n");
    expect(evidence(src)).toEqual([
      { kind: "property", passed: true, runs: 100, seed: 1337 },
      { kind: "property", passed: true, runs: 50, seed: 3 },
    ]);
    expect(evidence('it("c", () => properties(X));')).toEqual([EX]);
  });

  it("a helper's property run counts for the test that calls it", () => {
    const fixtures = file(
      "packages/a/test/fixtures.ts",
      `${FC}export const SEED = 1;\nexport function prove(p) { fc.assert(p, { seed: SEED, numRuns: 100 }); }\n`,
    );
    expect(evidence('import { prove } from "./fixtures";\nit("t", () => prove(p));', [fixtures])).toEqual([
      { kind: "property", passed: true, runs: 100, seed: 1 },
    ]);
  });

  it("facts expose imports, constants, objects, helpers and globals", () => {
    const f = testFacts(
      "x.test.ts",
      `${FC}import D, * as N from "m";\nexport const A = 1;\nconst O = { seed: A, k: 2, s: "x" };\nfunction h() {}\nit("t", () => {});`,
    );
    expect([...f.imports]).toEqual([
      ["fc", { from: "fast-check", name: "default" }],
      ["D", { from: "m", name: "default" }],
      ["N", { from: "m", name: "*" }],
    ]);
    expect([...f.consts]).toEqual([["A", 1]]);
    expect([...(f.objects.get("O") ?? [])]).toEqual([
      ["seed", 1],
      ["k", 2],
      ["s", undefined],
    ]);
    expect([...f.helpers.keys()]).toEqual(["h"]);
    expect(f.tests).toHaveLength(1);
    expect(f.global).toEqual({ runs: 100, seed: undefined });
  });
});

describe("mutationClaims", () => {
  const report = (mutants: unknown, source = "x"): string =>
    JSON.stringify({ thresholds: { high: 80, low: 60, break: 50 }, files: { "src/a.ts": { source, mutants } } });
  it("one claim per file with a scored mutant; detected / (detected + undetected), one decimal; timeouts detected", () => {
    const { mutation, fresh } = mutationClaims(
      [
        file("packages/a/src/a.ts", "x"),
        file(
          "packages/a/reports/mutation/mutation.json",
          report([
            { status: "Killed" },
            { status: "Timeout" },
            { status: "Survived" },
            { status: "NoCoverage" },
            { status: "CompileError" },
            { status: "Ignored" },
            { status: 1 },
            "x",
          ]),
        ),
        file("packages/b/src/a.ts", "y"),
        file(
          "packages/b/reports/mutation/mutation.json",
          report([{ status: "Killed" }, { status: "Survived" }, { status: "Killed" }], "y"),
        ),
        file("packages/c/reports/mutation/mutation.json", report([{ status: "Ignored" }])),
        file("packages/d/reports/mutation/mutation.json", "{not json"),
        file("packages/e/reports/mutation/mutation.json", JSON.stringify({ files: [] })),
        file("packages/h/reports/mutation/other.json", report([{ status: "Killed" }])),
        file("apps/x/reports/mutation/mutation.json", report([{ status: "Killed" }])),
      ],
      undefined,
    );
    expect(mutation.claims.map((c) => [c.file, c.killed, c.survived, c.noCoverage, c.score])).toEqual([
      ["packages/a/src/a.ts", 2, 1, 1, 50],
      ["packages/b/src/a.ts", 2, 1, 0, 66.67],
    ]);
    expect(mutation.packages).toEqual({
      a: { score: 50, threshold: 50 },
      b: { score: 66.67, threshold: 50 },
      c: { threshold: 50 },
    });
    expect([...fresh]).toEqual(["packages/a/src/a.ts", "packages/b/src/a.ts"]);
  });

  it("a changed file's claim is stale and its package score omits it; committed claims are kept", () => {
    const committed = {
      packages: { a: { score: 100, threshold: 70 } },
      claims: [{ file: "packages/a/src/b.ts", sha: "0", killed: 1, survived: 0, noCoverage: 0, score: 100 }],
    };
    const { mutation, fresh } = mutationClaims(
      [
        file("packages/a/src/a.ts", "changed"),
        file("packages/a/src/b.ts", "kept"),
        file("packages/a/reports/mutation/mutation.json", report([{ status: "Killed" }])),
      ],
      committed,
    );
    expect(mutation.claims.map((c) => c.file)).toEqual(["packages/a/src/a.ts", "packages/a/src/b.ts"]);
    expect(fresh.size).toBe(0);
    expect(mutation.packages).toEqual({ a: { threshold: 50 } });
  });
});

describe("readProject ledger scope", () => {
  const made: string[] = [];
  afterEach(() => {
    for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
  });
  it("adds packages/<pkg>/reports/mutation/mutation.json to the query files; query and tree skip reports", () => {
    const d = realpathSync(mkdtempSync(join(tmpdir(), "keel-ledger-scope-")));
    made.push(d);
    for (const [rel, text] of [
      ["packages/a/src/a.ts", "x"],
      ["packages/a/reports/mutation/mutation.json", "{}"],
      ["packages/a/reports/mutation/mutation.html", "<p>"],
      ["packages/a/reports/other/mutation.json", "{}"],
      ["reports/mutation/mutation.json", "{}"],
      ["packages/a/b/reports/mutation/mutation.json", "{}"],
    ]) {
      const abs = join(d, rel ?? "");
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, text ?? "");
    }
    const paths = (scope: "query" | "ledger" | "tree") => readProject(d, scope).map((f) => f.path);
    expect(paths("ledger")).toEqual(["packages/a/reports/mutation/mutation.json", "packages/a/src/a.ts"]);
    expect(paths("query")).toEqual(["packages/a/src/a.ts"]);
    expect(paths("tree")).toEqual(["packages/a/src/a.ts"]);
  });
});

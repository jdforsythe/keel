// Spec: k.errors, clause "In `modules/m/a.ts`, `function f() { try { return defect('bug') } finally { return 7 } }`, `for (;;) { try { g() } finally { break } }` and `for (const x of xs) { try { g(x) } finally { continue } }` are one E1452 each, message `control leaves finally and drops its throw`, at the `return`, `break` or `continue`; `try { g() } finally { for (;;) { break } }` and `try { g() } finally { h() }` are none." (the repository half: `tooling/structure-lint.mjs`)
// k.errors, Rules "E1452 `try`/`catch`, `.catch()`, a `.then()` given a second argument, `Promise.allSettled` or `Promise.any` in app code (fix: `attempt`), and a `return`, `break` or `continue` whose target lies outside the `finally` block holding it, at the statement, message `control leaves finally and drops its throw` (no fix), in app code and, in this repository, every package's `src/` and `unsafe/` (`tooling/structure-lint.mjs`, as S0018)"
// k.unsafe, Rules "E1762 a type predicate or assertion function, its declaration or arrow function, whose claimed type Type predicates says no body can prove, at the return type, message `type predicate claims <what> no check proves; move it into unsafe()` (`<what>` `a call signature` or `a type parameter`), in app code and a library's files outside lifted ranges and, in this repository, in every package's `src/` (`tooling/structure-lint.mjs` S0019, same position and message), no fix"
// Seed 1337 (the property). The real `tooling/structure-lint.mjs --root <tmp>` runs over a throwaway root holding the files.
// The two findings carry the codes S0018 (control leaving a `finally`) and S0019 (E1762's predicate): a finding is read by its `code` and `path`, not by its text.
// Assumption: E1762 runs through `check()`'s type pass "on each package's tsconfig", so the fixture package holds a `tsconfig.json` of its own.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { testTime } from "@keel/tooling/test-time";
import fc from "fast-check";
import { afterAll, describe, expect, test } from "vitest";
import { root } from "./test-sim-project.ts";

const LINT = join(root, "tooling", "structure-lint.mjs");
const SEED = 1337;
const made: string[] = [];
afterAll(() => {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

const TSCONFIG = JSON.stringify({
  compilerOptions: {
    target: "ES2022",
    module: "ESNext",
    moduleResolution: "Bundler",
    strict: true,
    noEmit: true,
    allowImportingTsExtensions: true,
  },
  include: ["src", "unsafe"],
});

interface Finding {
  code: string;
  path: string;
}
const isFinding = (v: unknown): v is Finding =>
  typeof v === "object" &&
  v !== null &&
  "code" in v &&
  typeof v.code === "string" &&
  "path" in v &&
  typeof v.path === "string";

/** The structure-lint findings (JSON records) over a throwaway root holding `files`, of `code` at `path`. */
function lint(files: Readonly<Record<string, string>>, code: string, path: string): Finding[] {
  const dir = mkdtempSync(join(tmpdir(), "keel-finally-"));
  made.push(dir);
  for (const [file, source] of Object.entries({ "packages/p/tsconfig.json": TSCONFIG, ...files })) {
    mkdirSync(dirname(join(dir, file)), { recursive: true });
    writeFileSync(join(dir, file), source);
  }
  const r = spawnSync(process.execPath, [LINT, "--root", dir, "--format=json"], {
    encoding: "utf8",
    timeout: testTime(60_000),
  });
  return r.stdout
    .split("\n")
    .filter((l) => l.startsWith("{"))
    .map((l): unknown => JSON.parse(l))
    .filter(isFinding)
    .filter((d) => d.code === code && d.path === path);
}

const BAD = [
  "export function f(g: () => void): number { try { g(); return 1 } finally { return 7 } }",
  "export function f(g: () => void): void { for (;;) { try { g() } finally { break } } }",
  "export function f(g: () => void, xs: number[]): void { for (const x of xs) { try { g(); void x } finally { continue } } }",
];
const GOOD = [
  "export function f(g: () => void): void { try { g() } finally { for (;;) { break } } }",
  "export function f(g: () => void, h: () => void): void { try { g() } finally { h() } }",
];

describe("structure-lint: S0018 control leaving a `finally` in every package's `src/` and `unsafe/`", () => {
  test("a `return`, `break` or `continue` leaving a `finally` in `packages/p/src/a.ts` is one S0018", () => {
    for (const source of BAD)
      expect(lint({ "packages/p/src/a.ts": `${source}\n` }, "S0018", "packages/p/src/a.ts"), source).toHaveLength(1);
  }, 120_000);

  test("one in `packages/p/unsafe/a.ts` is one S0018 too", () => {
    for (const source of BAD)
      expect(lint({ "packages/p/unsafe/a.ts": `${source}\n` }, "S0018", "packages/p/unsafe/a.ts"), source).toHaveLength(
        1,
      );
  }, 120_000);

  test("`try { g() } finally { for (;;) { break } }` and `try { g() } finally { h() }` are none", () => {
    for (const source of GOOD)
      expect(lint({ "packages/p/src/a.ts": `${source}\n` }, "S0018", "packages/p/src/a.ts"), source).toEqual([]);
  }, 120_000);

  test("property: in a kernel package's folder, as in any other, the exit is reported", () => {
    const folder = fc.constantFrom("schema", "reactive", "store", "std-x");
    const cases = fc.sample(fc.record({ folder, source: fc.constantFrom(...BAD) }), { seed: SEED, numRuns: 4 });
    for (const c of cases) {
      const path = `packages/${c.folder}/src/a.ts`;
      expect(lint({ [path]: `${c.source}\n` }, "S0018", path), path).toHaveLength(1);
    }
  }, 240_000);
});

describe("structure-lint: S0019 (E1762) in every package's `src/`", () => {
  const CLAIM =
    "export const isRunner = (x: unknown): x is { run(n: number): string } => typeof x === 'object' && x !== null\n";
  const PLAIN = "export const isRow = (x: unknown): x is { id: string } => typeof x === 'object' && x !== null\n";

  test("a predicate claiming a call signature in `packages/p/src/a.ts` is one S0019", () => {
    expect(lint({ "packages/p/src/a.ts": CLAIM }, "S0019", "packages/p/src/a.ts")).toHaveLength(1);
  }, 120_000);

  test("a predicate claiming plain data is none", () => {
    expect(lint({ "packages/p/src/a.ts": PLAIN }, "S0019", "packages/p/src/a.ts")).toEqual([]);
  }, 120_000);
});

// Spec: k.errors, clause "In `modules/m/a.ts`, `function f() { try { return defect('bug') } finally { return 7 } }`, `for (;;) { try { g() } finally { break } }` and `for (const x of xs) { try { g(x) } finally { continue } }` are one E1452 each, message `control leaves finally and drops its throw`, at the `return`, `break` or `continue`; `try { g() } finally { for (;;) { break } }` and `try { g() } finally { h() }` are none." (the repository half: `tooling/structure-lint.mjs`)
// k.errors, Rules bullet "E1452 a catch in any form. `try`/`catch`: `catch in app code: cleanup is try/finally, an expected failure is attempt(fn, expect)`. `.catch()`, a `.then()` given a second argument (`.then(f, g)`), `Promise.allSettled` and `Promise.any`: `<form> in app code: await it; an expected failure is attempt(fn, expect)`. A `return`, `break` or `continue` whose target lies outside the `finally` block holding it, at the statement: `control leaves finally and drops its throw`. A `defect` call in a `finally` block: `defect in finally drops the throw in flight`. The last two also in this repository's every package's `src/` and `unsafe/` (`tooling/structure-lint.mjs`, S0020). `attempt` with one argument and an `expect` that tests nothing: k.attempt."
// k.identity, Rules "E1762 a type predicate or assertion function, its declaration or arrow function, whose body is no proof above, at the return type, message `type predicate claims <what> it does not prove: check it, or use unsafe()` (`<what>` the first of: `property <p>`, `a call signature`, `a type parameter`, `a type argument`, `its whole type`), in app code and a library's files outside lifted ranges and, in this repository, in every package's `src/` (`tooling/structure-lint.mjs` S0019, same position and message), no fix"
// Seed 1337 (the property). The real `tooling/structure-lint.mjs --root <tmp>` runs over a throwaway root holding the files.
// The two findings carry the codes S0020 (control leaving a `finally`) and S0019 (E1762's predicate): a finding is read by its `code` and `path`, not by its text.
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

describe("structure-lint: S0020 control leaving a `finally` in every package's `src/` and `unsafe/`", () => {
  test("a `return`, `break` or `continue` leaving a `finally` in `packages/p/src/a.ts` is one S0020", () => {
    for (const source of BAD)
      expect(lint({ "packages/p/src/a.ts": `${source}\n` }, "S0020", "packages/p/src/a.ts"), source).toHaveLength(1);
  }, 120_000);

  test("one in `packages/p/unsafe/a.ts` is one S0020 too", () => {
    for (const source of BAD)
      expect(lint({ "packages/p/unsafe/a.ts": `${source}\n` }, "S0020", "packages/p/unsafe/a.ts"), source).toHaveLength(
        1,
      );
  }, 120_000);

  test("`try { g() } finally { for (;;) { break } }` and `try { g() } finally { h() }` are none", () => {
    for (const source of GOOD)
      expect(lint({ "packages/p/src/a.ts": `${source}\n` }, "S0020", "packages/p/src/a.ts"), source).toEqual([]);
  }, 120_000);

  test("property: in a kernel package's folder, as in any other, the exit is reported", () => {
    const folder = fc.constantFrom("schema", "reactive", "store", "std-x");
    const cases = fc.sample(fc.record({ folder, source: fc.constantFrom(...BAD) }), { seed: SEED, numRuns: 4 });
    for (const c of cases) {
      const path = `packages/${c.folder}/src/a.ts`;
      expect(lint({ [path]: `${c.source}\n` }, "S0020", path), path).toHaveLength(1);
    }
  }, 240_000);
});

describe("structure-lint: S0019 (E1762) in every package's `src/`", () => {
  const CLAIM =
    "export const isRunner = (x: unknown): x is { run(n: number): string } => typeof x === 'object' && x !== null\n";
  const PLAIN =
    "export const isRow = (x: unknown): x is { id: string } => typeof x === 'object' && x !== null && typeof Reflect.get(x, 'id') === 'string'\n";

  test("a predicate claiming a call signature in `packages/p/src/a.ts` is one S0019", () => {
    expect(lint({ "packages/p/src/a.ts": CLAIM }, "S0019", "packages/p/src/a.ts")).toHaveLength(1);
  }, 120_000);

  test("a predicate claiming plain data is none", () => {
    expect(lint({ "packages/p/src/a.ts": PLAIN }, "S0019", "packages/p/src/a.ts")).toEqual([]);
  }, 120_000);
});

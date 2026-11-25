// Spec: k.unsafe, Conformance "In `tooling/structure-lint.mjs` over a root holding `packages/p/unsafe/a.ts` with `unsafe(\"one two three four five six seven eight\", () => 1)`, one S0014; with `() => c as T` in place of `() => 1`, none."
// Seed 1337 (the property). Home: the RFC names `packages/cli/conformance/` for this file (k.unsafe is `@keel/cli`'s in
// `tooling/docs-owners.json`, so the clause takes its rung from here); S0012's neighbour sits in `tooling/test/`. The real
// `tooling/structure-lint.mjs --root <tmp>` runs over a throwaway root holding one file; its S0014 findings are read.
// Fixture text is built from constants so this file's own source holds no literal `unsafe(` call.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import fc from "fast-check";
import { afterAll, describe, expect, test } from "vitest";
import { root } from "./test-sim-project.ts";

const LINT = join(root, "tooling", "structure-lint.mjs");
const U = "unsafe";
const IGNORE = `@ts-${"ignore"}`;
const SEED = 1337;
const made: string[] = [];
afterAll(() => {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

type Finding = { code: string; path: string; line?: number };
const isFinding = (v: unknown): v is Finding =>
  typeof v === "object" &&
  v !== null &&
  "code" in v &&
  typeof v.code === "string" &&
  "path" in v &&
  typeof v.path === "string";

/** structure-lint over a throwaway root holding `files`; its S0014 findings. */
function s0014(files: Readonly<Record<string, string>>): Finding[] {
  const dir = mkdtempSync(join(tmpdir(), "keel-s0014-"));
  made.push(dir);
  for (const [file, source] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, file)), { recursive: true });
    writeFileSync(join(dir, file), source);
  }
  const r = spawnSync(process.execPath, [LINT, "--root", dir, "--format=json"], { encoding: "utf8", timeout: 60_000 });
  return r.stdout
    .split("\n")
    .filter((l) => l.startsWith("{"))
    .map((l): unknown => JSON.parse(l))
    .filter(isFinding)
    .filter((d) => d.code === "S0014");
}

const REASON = "one two three four five six seven eight";
const call = (fn: string): string => `${U}("${REASON}", ${fn})`;
const FILE = `packages/p/${U}/a.ts`;

describe("k.unsafe Rules: S0014", () => {
  test('In `tooling/structure-lint.mjs` over a root holding `packages/p/unsafe/a.ts` with `unsafe("one two three four five six seven eight", () => 1)`, one S0014', () => {
    const d = s0014({ [FILE]: `${call("() => 1")}\n` });
    expect(d).toHaveLength(1);
    expect(d[0]?.path).toBe(FILE);
  }, 90_000);

  test("with `() => c as T` in place of `() => 1`, none", () => {
    expect(s0014({ [FILE]: `declare const c: unknown\ntype T = number\n${call("() => c as T")}\n` })).toEqual([]);
  }, 90_000);

  test("property: a lifted range holding a cast, `!`, `any` or a ts-suppression comment is no S0014; one holding none of them is one", () => {
    const withEscape = fc.constantFrom(
      "() => c as T",
      "() => s!",
      "() => { const v: any = c; return v }",
      `() => {\n  // ${IGNORE} the line below is a deliberate error\n  const n: number = "x";\n  return n;\n}`,
    );
    const without = fc.constantFrom(
      "() => 1",
      "() => { return c }",
      "() => { const v: unknown = c; return v }",
      "async () => 2",
    );
    const head = "declare const c: unknown\ndeclare const s: string | undefined\ntype T = number\n";
    fc.assert(
      fc.property(withEscape, without, (esc, plain) => {
        expect(s0014({ [FILE]: `${head}${call(esc)}\n` })).toEqual([]);
        expect(s0014({ [FILE]: `${head}${call(plain)}\n` })).toHaveLength(1);
      }),
      { seed: SEED, numRuns: 4 },
    );
  }, 180_000);

  test("one S0014 per call whose range holds no finding, in a file with several calls", () => {
    const head = "declare const c: unknown\ntype T = number\n";
    const d = s0014({ [FILE]: `${head}${call("() => 1")}\n${call("() => c as T")}\n${call("() => 2")}\n` });
    expect(d).toHaveLength(2);
  }, 90_000);

  test("S0014 reads `packages/*` only: the same call in `apps/a/modules/m/unsafe/a.ts` is no S0014", () => {
    expect(s0014({ "apps/a/modules/m/unsafe/a.ts": `${call("() => 1")}\n` })).toEqual([]);
  }, 90_000);
});

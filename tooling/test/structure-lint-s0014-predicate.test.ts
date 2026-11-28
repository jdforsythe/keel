// Spec: k.unsafe, Unsafe: in a kernel package `unsafe/` holds type-system escapes, each call's function holding a cast,
// `!`, `any`, a ts-suppression comment or a type predicate E1762 reports; a lifted range holding such a predicate is
// no S0014, and one holding a predicate E1762 accepts is. The real `tooling/structure-lint.mjs --root <tmp>` runs over
// a throwaway root; its S0014 and S0019 findings are read. Fixture text is built from constants so this file's own
// source holds no literal `unsafe(` call.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { tempDir } from "@keel/tooling/test-tmp";
import { afterAll, describe, expect, it } from "vitest";
import { fixedTime, testTime } from "../test-time.ts";

const lint = path.join(import.meta.dirname, "..", "structure-lint.mjs");
const made: string[] = [];
afterAll(() => {
  for (const d of made) fs.rmSync(d, { recursive: true, force: true });
});

const U = "unsafe";
const REASON = "one two three four five six seven eight";
const KERNEL = JSON.stringify({ name: "@x/p", type: "module" });
const TSCONFIG = JSON.stringify({ compilerOptions: { strict: true, noEmit: true }, include: ["src", "unsafe"] });
const UNSAFE = `export function ${U}<T>(reason: string, fn: () => T): T {\n  return fn();\n}\n`;
/** A predicate claiming a brand no check establishes: E1762 reports it. */
const BRAND =
  `import { ${U} } from "./${U}.ts";\n` +
  `export const isB = ${U}("${REASON}", () => (x: string): x is string & { readonly b: true } => x.length > 0);\n`;
/** A predicate `typeof` proves: E1762 accepts it, so the call escapes nothing. */
const PROVEN =
  `import { ${U} } from "./${U}.ts";\n` +
  `export const isS = ${U}("${REASON}", () => (x: unknown): x is string => typeof x === "string");\n`;

/** structure-lint over a throwaway kernel package whose `unsafe/a.ts` is `source`; its S0014 and S0019 findings. */
function lintOf(source: string): { code: string; path: string }[] {
  const root = tempDir("keel-s0014-pred-");
  made.push(root);
  const files = {
    "packages/p/package.json": KERNEL,
    "packages/p/tsconfig.json": TSCONFIG,
    "packages/p/unsafe/unsafe.ts": UNSAFE,
    "packages/p/unsafe/a.ts": source,
  };
  for (const [file, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  }
  const r = spawnSync(process.execPath, [lint, "--root", root, "--format=json"], {
    encoding: "utf8",
    timeout: testTime(60_000),
  });
  return r.stdout
    .split("\n")
    .filter((l) => l.startsWith("{"))
    .map((l) => JSON.parse(l))
    .filter((d) => d.code === "S0014" || d.code === "S0019");
}

describe("k.unsafe S0014 and a type predicate in a kernel package's unsafe/", () => {
  it(
    "a lifted range holding a predicate E1762 reports is no S0014 and no S0019",
    () => {
      expect(lintOf(BRAND)).toEqual([]);
    },
    fixedTime(90_000),
  );

  it(
    "a lifted range holding a predicate E1762 accepts is one S0014",
    () => {
      const found = lintOf(PROVEN);
      expect(found.map((d) => d.code)).toEqual(["S0014"]);
      expect(found[0]?.path).toMatch(/packages\/p\/unsafe\/a\.ts$/);
    },
    fixedTime(90_000),
  );
});

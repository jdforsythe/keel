// Spec: k.check, clause "The json diagnostic `keel check` emits for a compiler fixture is byte-identical to the one the compiler emits."
// Drives the real binary (packages/cli/src/bin.ts) over a temp project; the in-process format(check()) test is only a proxy.
// Seed: 1337 (fc.assert seed below). Each spawn costs about a second, so numRuns is small.
import { fixedTime } from "@keel/tooling/test-time";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "@keel/compiler";
import fc from "fast-check";
import { afterAll, beforeAll, expect, test } from "vitest";
import { FIXTURES, SEED } from "./support.ts";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const BIN = path.join(repo, "packages/cli/src/bin.ts");
const COMPILER_CODES = ["E1001", "E1003", "E1401", "E1403", "E1404"];
const compilerFixtures = FIXTURES.filter((f) => COMPILER_CODES.includes(f.code));
const REL = "src/C.tsx";

const TSCONFIG = `${JSON.stringify(
  {
    extends: "@keel/compiler/tsconfig.strict.json",
    compilerOptions: { jsxImportSource: "@keel/runtime-dom" },
    include: ["src"],
  },
  null,
  2,
)}\n`;

let proj = "";

beforeAll(() => {
  proj = fs.mkdtempSync(path.join(os.tmpdir(), "keel-json-ident-"));
  fs.mkdirSync(path.join(proj, "src"), { recursive: true });
  fs.writeFileSync(path.join(proj, "tsconfig.json"), TSCONFIG);
  fs.mkdirSync(path.join(proj, "node_modules/@keel"), { recursive: true });
  for (const pkg of fs.readdirSync(path.join(repo, "packages"))) {
    fs.symlinkSync(path.join(repo, "packages", pkg), path.join(proj, "node_modules/@keel", pkg));
  }
  for (const name of ["vitest", "vite", "typescript"]) {
    fs.symlinkSync(path.join(repo, "node_modules", name), path.join(proj, "node_modules", name));
  }
}, fixedTime(60_000));

afterAll(() => {
  fs.rmSync(proj, { recursive: true, force: true });
});

function runBinary(source: string): string[] {
  fs.writeFileSync(path.join(proj, REL), source);
  const env: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (k.startsWith("VITEST") || k === "NODE_OPTIONS" || k === "TEST") continue;
    env[k] = v;
  }
  const r = spawnSync(process.execPath, [BIN, "check", "--format=json"], { cwd: proj, encoding: "utf8", env });
  return r.stdout.split("\n").filter((l) => l !== "");
}

test(
  "The json diagnostic `keel check` emits for a compiler fixture is byte-identical to the one the compiler emits (real binary)",
  () => {
    fc.assert(
      fc.property(fc.constantFrom(...compilerFixtures), (fx) => {
        const compiled = compile([{ path: REL, source: fx.bad }]).diagnostics;
        expect(compiled.length).toBeGreaterThan(0);
        const emitted = runBinary(fx.bad);
        for (const d of compiled) {
          const wanted = JSON.stringify({ kind: "diag", ...d });
          expect(emitted.filter((l) => l === wanted)).toEqual([wanted]);
        }
      }),
      { seed: SEED, numRuns: 5 },
    );
  },
  fixedTime(180_000),
);

test(
  "every compiler fixture, run once each through the real binary, has its compiler diagnostics as verbatim stdout lines",
  () => {
    for (const fx of compilerFixtures) {
      const compiled = compile([{ path: REL, source: fx.bad }]).diagnostics.filter((d) => d.code === fx.code);
      expect(compiled.length).toBeGreaterThan(0);
      const emitted = runBinary(fx.bad);
      for (const d of compiled) {
        expect(emitted).toContain(JSON.stringify({ kind: "diag", ...d }));
      }
    }
  },
  fixedTime(180_000),
);

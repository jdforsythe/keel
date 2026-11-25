// Spec: k.compat, Conformance "With a base where store `s` has state `{ a }`, adding a required field `b` is one E1563 at `b` whose fix leaves none, adding an optional one is none, removing a transaction of `s` is one W1564, and without `--base` there is neither."
// Spec: k.compat, Rules "E1563 a state schema change a base store's stored states fail, naming the store and the first refused path; fix as E1562"
// Spec: k.compat, Rules "W1564 a base transaction removed or its payload narrowed, naming it; no fix"
// Seed: 1337.
// ASSUMPTIONS (spec names no fixture layout): the stores factory lives in `modules/m/factory.server.ts` and is named by an action's `stores`;
// the surface is read through the real binary (`keel build` writes `.keel/surface.json`, `keel check --base <file>`), because the surface needs
// `routes.ts` evaluated, which in-memory `check(files)` does not do. State schemas are closed objects: an open `{ a }` admits an extra `b`
// a new `b: string.optional()` refuses (k.compat Accepts), so the base would not be accepted. "At `b`" is read as the diagnostic message naming `b`.
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import fc from "fast-check";
import { afterAll, describe, expect, test } from "vitest";

const SEED = 1337;
const SLOW = 300_000;
/**
 * What the `check --base` case bounds: two property runs of fourteen binary runs each (four `against` calls of two
 * builds and a check, a rebuild and a check), about 1.25 s a run here (35 s in all, up to 60 s beside other work). The
 * bound is 30 s a binary run, 24 times that, so a runner ten times slower (scale 0.1) still has room.
 */
const BASE_CASE_BOUND = 2 * 14 * 30_000;
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const BIN = join(REPO, "packages", "cli", "src", "bin.ts");

type Rec = { kind: string; code?: unknown; message?: unknown; fix?: unknown };
type Run = { status: number | null; records: Rec[] };
const isRec = (v: unknown): v is Rec =>
  typeof v === "object" && v !== null && "kind" in v && typeof v.kind === "string";

function keel(dir: string, args: string[]): Run {
  const env: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (k.startsWith("VITEST") || k === "NODE_OPTIONS" || k === "TEST") continue;
    env[k] = v;
  }
  const r = spawnSync(process.execPath, [BIN, ...args, "--format=json"], { cwd: dir, encoding: "utf8", env });
  const records: Rec[] = [];
  for (const line of r.stdout.split("\n")) {
    if (line.trim() === "") continue;
    try {
      const v: unknown = JSON.parse(line);
      if (isRec(v)) records.push(v);
    } catch {
      // non-JSON line: ignored
    }
  }
  return { status: r.status, records };
}
const diags = (run: Run, code: string): Rec[] => run.records.filter((r) => r.kind === "diag" && r.code === code);

type Tx = { readonly name: string; readonly payload: string };
type Shape = { readonly state: string; readonly initial: string; readonly txs: readonly Tx[] };

const ADD: Tx = { name: "m.add", payload: "s.object({ n: s.int() }, { closed: true })" };
const RESET: Tx = { name: "m.reset", payload: "s.object({}, { closed: true })" };
const BASE: Shape = {
  state: "s.object({ a: s.string() }, { closed: true })",
  initial: "{ a: '' }",
  txs: [ADD, RESET],
};

function files(sh: Shape): Record<string, string> {
  const txs = sh.txs
    .map((t, i) => `  const t${i} = transaction(st, '${t.name}', ${t.payload}, (state) => state)`)
    .join("\n");
  return {
    "package.json": `${JSON.stringify({ name: "fx", private: true, type: "module" })}\n`,
    "vite.config.ts":
      'import keel from "@keel/compiler/vite";\nimport { defineConfig } from "vite";\nexport default defineConfig({ plugins: [keel()] });\n',
    "tsconfig.json": JSON.stringify({
      compilerOptions: { jsx: "react-jsx", jsxImportSource: "@keel/runtime-dom", module: "esnext", target: "es2022" },
    }),
    "topology.ts":
      "import { topology } from '@keel/server'\nexport default topology({ x: { modules: ['m'], adapter: 'node' } })\n",
    "modules/m/module.ts":
      "import { module } from '@keel/compiler'\nexport default module({ id: 'm', deps: [], capabilities: [], public: { exports: [] } })\n",
    "modules/m/factory.server.ts":
      "import { s } from '@keel/schema'\nimport { store, transaction } from '@keel/store'\n" +
      "export const factory = () => {\n" +
      `  const st = store(${sh.state}, ${sh.initial}, { id: 'm.s' })\n${txs}\n` +
      `  return { st${sh.txs.map((_, i) => `, t${i}`).join("")} }\n}\n`,
    "modules/m/save.server.ts":
      "import { action } from '@keel/router'\nimport { ok, s } from '@keel/schema'\nimport { m } from './m.contract.ts'\nimport { factory } from './factory.server.ts'\n" +
      "export const save = action(m, 'm.save', { input: s.object({}), stores: factory }, async () => ok(null))\n",
    "modules/m/m.contract.ts":
      "import { contract } from '@keel/router/contract'\nexport const m = contract('m', { 'm.save': { path: '/m/save' } })\n",
    "modules/m/routes.ts":
      "import { manifest } from '@keel/router'\nimport { Text } from '@keel/ui'\nimport { m } from './m.contract.ts'\nimport { save } from './save.server.ts'\n" +
      "const Page = () => Text({ children: 'x' })\n" +
      "export const routes = manifest(m, { 'm.save': { component: Page, POST: save } })\n",
  };
}

function materialize(tree: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "keel-stored-"));
  write(dir, tree);
  mkdirSync(join(dir, "node_modules/@keel"), { recursive: true });
  for (const pkg of readdirSync(join(REPO, "packages"))) {
    symlinkSync(join(REPO, "packages", pkg), join(dir, "node_modules/@keel", pkg));
  }
  for (const name of ["vitest", "vite", "typescript", "fast-check"]) {
    symlinkSync(join(REPO, "node_modules", name), join(dir, "node_modules", name));
  }
  return dir;
}
function write(dir: string, tree: Record<string, string>): void {
  for (const [path, content] of Object.entries(tree)) {
    const full = join(dir, path);
    mkdirSync(dirname(full), { recursive: true });
    rmSync(full, { force: true });
    writeFileSync(full, content);
  }
}

const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

/** Builds `base` in a temp project, keeps its surface as `base.json`, rebuilds with `current` and checks (with `--base` unless `withBase` is false). */
function against(base: Shape, current: Shape, withBase = true): { dir: string; basePath: string; run: Run } {
  const dir = materialize(files(base));
  dirs.push(dir);
  expect(keel(dir, ["build"]).status).toBe(0);
  const basePath = join(dir, "base-surface.json");
  copyFileSync(join(dir, ".keel/surface.json"), basePath);
  write(dir, files(current));
  expect(keel(dir, ["build"]).status).toBe(0);
  return { dir, basePath, run: keel(dir, withBase ? ["check", "--base", basePath] : ["check"]) };
}

const field = fc.constantFrom("b", "qty", "note");
const withField = (f: string, optional: boolean): Shape => ({
  ...BASE,
  state: `s.object({ a: s.string(), ${f}: s.string()${optional ? ".optional()" : ""} }, { closed: true })`,
  initial: optional ? "{ a: '' }" : `{ a: '', ${f}: '' }`,
});

describe("k.compat: stored-schema checks through `check --base`", () => {
  test(
    "With a base where store `s` has state `{ a }`, adding a required field `b` is one E1563 at `b` whose fix leaves none, adding an optional one is none, removing a transaction of `s` is one W1564, and without `--base` there is neither.",
    () => {
      fc.assert(
        fc.property(field, (f) => {
          const required = against(BASE, withField(f, false));
          const e1563 = diags(required.run, "E1563");
          expect(e1563).toHaveLength(1);
          expect(String(e1563[0]?.message)).toContain(f);
          expect(e1563[0]?.fix).toBeDefined();
          write(required.dir, files(withField(f, true)));
          expect(keel(required.dir, ["build"]).status).toBe(0);
          expect(diags(keel(required.dir, ["check", "--base", required.basePath]), "E1563")).toEqual([]);

          expect(diags(against(BASE, withField(f, true)).run, "E1563")).toEqual([]);

          const removed = against(BASE, { ...BASE, txs: [ADD] });
          expect(diags(removed.run, "W1564")).toHaveLength(1);
          expect(String(diags(removed.run, "W1564")[0]?.message)).toContain("m.reset");

          const bare = against(BASE, { ...withField(f, false), txs: [ADD] }, false);
          expect(diags(bare.run, "E1563")).toEqual([]);
          expect(diags(bare.run, "W1564")).toEqual([]);
        }),
        { seed: SEED, numRuns: 2 },
      );
    },
    BASE_CASE_BOUND,
  );

  test(
    "E1563 a state schema change a base store's stored states fail, naming the store and the first refused path; fix as E1562",
    () => {
      const found = diags(against(BASE, withField("b", false)).run, "E1563");
      expect(found).toHaveLength(1);
      expect(String(found[0]?.message)).toContain("m.s");
      expect(String(found[0]?.message)).toContain("b");
      expect(typeof found[0]?.fix).toBe("string");
    },
    SLOW,
  );

  test(
    "W1564 a base transaction removed or its payload narrowed, naming it; no fix",
    () => {
      const removed = diags(against(BASE, { ...BASE, txs: [ADD] }).run, "W1564");
      expect(removed).toHaveLength(1);
      expect(String(removed[0]?.message)).toContain("m.reset");
      expect(removed[0]?.fix).toBeUndefined();

      const narrowed = diags(
        against(BASE, {
          ...BASE,
          txs: [{ name: "m.add", payload: "s.object({ n: s.int(), extra: s.string() }, { closed: true })" }, RESET],
        }).run,
        "W1564",
      );
      expect(narrowed).toHaveLength(1);
      expect(String(narrowed[0]?.message)).toContain("m.add");
      expect(narrowed[0]?.fix).toBeUndefined();

      expect(diags(against(BASE, BASE).run, "W1564")).toEqual([]);
    },
    SLOW,
  );
});

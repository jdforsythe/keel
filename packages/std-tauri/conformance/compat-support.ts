// Shared helpers for the k.compat conformance files (not a test file). Public surface only: the `keel` binary over a temp project.
// Seed 1337 for every property in this suite.
// ASSUMED (spec names no fixture layout): module `y` serves a contract (k.contract) that module `a` calls with `service({ contract })`;
// `keel build` writes `.keel/surface.json` then `keel check [--base <file>] --format=json` reads it. No git fixture is needed: `--base` reads a surface.json file (the
// generated CI hands it the base branch's), so the base is a copy of an earlier build's artifact.
// There is no conformance/fixtures/ directory: projects are built in the test body from the parameters below (the surface
// needs the contract file evaluated, which the in-memory `check(files)` does not do).
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const SEED = 1337;

function findRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (;;) {
    try {
      statSync(join(dir, "pnpm-workspace.yaml"));
      return dir;
    } catch {
      const up = dirname(dir);
      if (up === dir) throw new Error("repo root (pnpm-workspace.yaml) not found");
      dir = up;
    }
  }
}
const root = findRoot();

export type Rec = {
  kind: string;
  code?: unknown;
  path?: unknown;
  message?: unknown;
  fix?: unknown;
  [k: string]: unknown;
};
export type Run = { status: number | null; records: Rec[] };

function isRec(v: unknown): v is Rec {
  return typeof v === "object" && v !== null && "kind" in v && typeof v.kind === "string";
}

export function keel(dir: string, args: string[]): Run {
  const env: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (k.startsWith("VITEST") || k === "NODE_OPTIONS" || k === "TEST") continue;
    env[k] = v;
  }
  const r = spawnSync(process.execPath, [join(root, "packages/cli/src/bin.ts"), ...args, "--format=json"], {
    cwd: dir,
    encoding: "utf8",
    env,
  });
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

export const diags = (run: Run, code: string): Rec[] => run.records.filter((r) => r.kind === "diag" && r.code === code);

export type Tree = Record<string, string>;

export function materialize(files: Tree): string {
  const dir = mkdtempSync(join(tmpdir(), "keel-compat-"));
  write(dir, files);
  mkdirSync(join(dir, "node_modules/@keel"), { recursive: true });
  for (const pkg of readdirSync(join(root, "packages"))) {
    symlinkSync(join(root, "packages", pkg), join(dir, "node_modules/@keel", pkg));
  }
  for (const name of ["vitest", "vite", "typescript", "fast-check"]) {
    symlinkSync(join(root, "node_modules", name), join(dir, "node_modules", name));
  }
  return dir;
}

export function write(dir: string, files: Tree): void {
  for (const [path, content] of Object.entries(files)) {
    const full = join(dir, path);
    mkdirSync(dirname(full), { recursive: true });
    try {
      writeFileSync(full, content);
    } catch {
      rmSync(full, { force: true });
      writeFileSync(full, content);
    }
  }
}

export const cleanup = (dir: string): void => rmSync(dir, { recursive: true, force: true });
export const readText = (dir: string, path: string): string => readFileSync(join(dir, path), "utf8");

export type Shape = {
  /** Source of the `body` of entry `y.add` (POST); default `{ name }`. */
  body?: string;
  /** Source of the `output` of entry `y.load` (GET), and a value of it; default `{ id }`. */
  output?: string;
  outputValue?: string;
  /** Source of the `errors[409]` schema of `y.add`. */
  errors?: string;
  /** Deployables: `x` (module a) and `y` (module y), or one deployable `x` holding both. */
  split?: boolean;
  /** `deps` of module a. */
  deps?: string[];
  /** The shared path of `y.add` and `y.load` (default `/y/save`). */
  path?: string;
};

/** The answer of `y.add`: the entry's `output`. */
export const ACTION_ANSWER = "s.string().nullable()";

/**
 * A two-module project: module `y` serves the contract `y` with two API entries at one path, `y.add` (POST, `body`, `output`
 * `ACTION_ANSWER`, optional `errors`) and `y.load` (GET, `output`); module `a` calls them through `service({ contract: y })`
 * in `modules/a/api.ts`.
 */
export function project(sh: Shape = {}): Tree {
  const body = sh.body ?? "s.object({ name: s.string() })";
  const output = sh.output ?? "s.object({ id: s.string() })";
  const q = (xs: string[]): string => `[${xs.map((x) => `'${x}'`).join(", ")}]`;
  const path = sh.path ?? "/y/save";
  const topo =
    sh.split === false
      ? "{ x: { modules: ['a', 'y'], adapter: 'node' } }"
      : "{ x: { modules: ['a'], adapter: 'node' }, y: { modules: ['y'], adapter: 'node' } }";
  return {
    "topology.ts": `import { topology } from '@keel/server'\nexport default topology(${topo})\n`,
    "modules/a/module.ts":
      `import { module } from '@keel/compiler'\n` +
      `export default module({ id: 'a', deps: ${q(sh.deps ?? ["y"])}, capabilities: [], public: { exports: [] } })\n`,
    "modules/y/module.ts":
      `import { module } from '@keel/compiler'\n` +
      `export default module({ id: 'y', deps: [], capabilities: [], public: { exports: [] } })\n`,
    "modules/y/y.contract.ts":
      `import { contract } from '@keel/router/contract'\nimport { s } from '@keel/schema'\n` +
      `export const y = contract('y', {\n` +
      `  'y.add': { method: 'POST', path: '${path}', body: ${body}, output: ${ACTION_ANSWER}` +
      `${sh.errors === undefined ? "" : `, errors: { 409: ${sh.errors} }`} },\n` +
      `  'y.load': { method: 'GET', path: '${path}', output: ${output} },\n` +
      `})\n`,
    "modules/y/load.server.ts":
      `import { loader } from '@keel/router'\nimport { ok } from '@keel/schema'\nimport { y } from './y.contract.ts'\n` +
      `export const load = loader(y, 'y.load', {}, async () => ok(${sh.outputValue ?? "{ id: 'i' }"}))\n`,
    "modules/y/add.server.ts":
      `import { action } from '@keel/router'\nimport { ok } from '@keel/schema'\nimport { y } from './y.contract.ts'\n` +
      `export const add = action(y, 'y.add', {}, async () => ok(null))\n`,
    "modules/y/routes.ts":
      `import { manifest } from '@keel/router'\nimport { y } from './y.contract.ts'\n` +
      `import { add } from './add.server.ts'\nimport { load } from './load.server.ts'\n` +
      `export const routes = manifest(y, { 'y.load': { loader: load }, 'y.add': { action: add } })\n`,
    "modules/a/api.ts":
      `import { service } from '@keel/services'\nimport { y } from '../y/y.contract.ts'\n` +
      `export const api = service({ contract: y })\n`,
  };
}

/** Build the project, then check it (optionally against a base surface file). */
export function buildAndCheck(dir: string, base?: string): Run {
  const built = keel(dir, ["build"]);
  if (
    built.status !== 0 &&
    built.records.some((r) => r.kind === "diag" && r.code !== undefined && String(r.code).startsWith("E10"))
  )
    return built;
  return keel(dir, base === undefined ? ["check"] : ["check", "--base", base]);
}

/** Build `files` in a temp project and return `.keel/surface.json` copied beside it as `base.json`; the project dir is returned too. */
export function baseSurface(files: Tree): { dir: string; base: string } {
  const dir = materialize(files);
  keel(dir, ["build"]);
  const base = join(dir, "..", `${dir.split("/").pop()}-base.json`);
  writeFileSync(base, readFileSync(join(dir, ".keel/surface.json"), "utf8"));
  return { dir, base };
}

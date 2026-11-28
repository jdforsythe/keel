// Spec: k.check-cache, clause "In one process that has not imported `@keel/std-db` or `@keel/std-db/tools`, with `root` and the two files of the previous case but `deps` set to `['@keel/std-db']`, `importDeps(root, files)` then `check(files, { root, types: false })` reports one E2151 at `modules/orders/x.ts` line 1; with `deps` then set to `[]`, `importDeps(root, files)` then `check(files, { root, types: false })` reports no E2151, as a fresh `keel check` of that tree reports none."
// Seed 1337 (no generated input). This file imports neither `@keel/std-db` nor `@keel/std-db/tools`, statically or through a fixture, so `importDeps` makes the
// package's first import in this process (vitest gives each test file its own module registry); the fresh run is the real binary over a scratch project.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { check } from "@keel/check";
import { importDeps } from "@keel/compiler/std/importDeps";
import { afterAll, expect, test } from "vitest";

/** The test declares its bound (docs/TESTING.md Wall-clock bounds). */
const SLOW = 120_000;
const pkg = join(dirname(fileURLToPath(import.meta.url)), "..");
const repo = join(pkg, "../..");
const BIN = join(repo, "packages/cli/src/bin.ts");
const files = (deps: string[]) => [
  {
    path: "modules/orders/module.ts",
    source: `import { module } from '@keel/compiler'\nexport default module({ id: 'orders', deps: [${deps.map((d) => `'${d}'`).join(", ")}], capabilities: [], public: { exports: [] } })\n`,
  },
  { path: "modules/orders/x.ts", source: "import * as db from '@keel/std-db'\nexport const y = db\n" },
];

const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

/** A scratch project of `list`, \`@keel/*\` linked to this repository's packages. */
function project(list: readonly { path: string; source: string }[]): string {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "keel-deps-dropped-rule-")));
  dirs.push(dir);
  writeFileSync(join(dir, "package.json"), '{"name":"p","private":true,"type":"module"}\n');
  for (const f of list) {
    mkdirSync(dirname(join(dir, f.path)), { recursive: true });
    writeFileSync(join(dir, f.path), f.source);
  }
  mkdirSync(join(dir, "node_modules/@keel"), { recursive: true });
  for (const p of readdirSync(join(repo, "packages")))
    symlinkSync(join(repo, "packages", p), join(dir, "node_modules/@keel", p));
  for (const name of ["vitest", "vite", "typescript", "fast-check"])
    symlinkSync(join(repo, "node_modules", name), join(dir, "node_modules", name));
  return dir;
}

/** \`keel check --format=json\` over the scratch project: its exit status and its E2151 lines. */
function fresh(dir: string): { status: number | null; e2151: Record<string, unknown>[] } {
  const env: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (k.startsWith("VITEST") || k === "NODE_OPTIONS" || k === "TEST") continue;
    env[k] = v;
  }
  const r = spawnSync(process.execPath, [BIN, "check", "--format=json"], { cwd: dir, encoding: "utf8", env });
  const found: Record<string, unknown>[] = [];
  for (const line of r.stdout.split("\n")) {
    if (line.trim() === "") continue;
    const v: unknown = JSON.parse(line);
    if (typeof v === "object" && v !== null && "code" in v && v.code === "E2151") found.push({ ...v });
  }
  return { status: r.status, e2151: found };
}

const e2151 = async (root: string, deps: string[]) => {
  const list = files(deps);
  await importDeps(root, list);
  return check(list, { root, types: false }).diagnostics.filter((d) => d.code === "E2151");
};

test(
  "a rule whose package `importDeps` imported first is left out once `deps` drop it, as a fresh `keel check` reports",
  async () => {
    const root = project(files(["@keel/std-db"]));
    const listed = await e2151(root, ["@keel/std-db"]);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.path).toBe("modules/orders/x.ts");
    expect(listed[0]?.line).toBe(1);
    expect(await e2151(root, [])).toEqual([]);
    const run = fresh(project(files([])));
    expect(run.e2151).toEqual([]);
  },
  SLOW,
);

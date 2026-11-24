// Spec: k.check-cache, clause "In one process, after `@keel/std-temporal` has been imported, `check()` over a module whose `module.ts` lists `@keel/std-temporal` in `deps` and whose file holds `formatLiteral(Instant, '2026-02-28T00:00:00.000Z')` reports no E1108; with that module's `deps` then empty, a second `check()` over the same files reports one E1108 at the call, as a fresh `keel check` of that tree does, which exits 1."
// Seed 1337 (no generated input). This package imports `@keel/std-temporal` below, so the package "has been imported" in this process; the fresh run is the real binary over a scratch project.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { check } from "@keel/check";
import { Instant } from "@keel/std-temporal";
import { afterAll, expect, test } from "vitest";

/** The test declares its bound (docs/TESTING.md Wall-clock bounds). */
const SLOW = 120_000;
const repo = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const BIN = join(repo, "packages/cli/src/bin.ts");
const MODULE = (deps: string[]) => ({
  path: "modules/app/module.ts",
  source: `import { module } from '@keel/compiler'\nexport default module({ id: 'app', deps: [${deps.map((d) => `'${d}'`).join(", ")}], capabilities: [], public: { exports: [] } })\n`,
});
const AT = {
  path: "modules/app/At.ts",
  source: `import { formatLiteral } from '@keel/schema'\nimport { Instant } from '@keel/std-temporal'\nexport const x = formatLiteral(Instant, '2026-02-28T00:00:00.000Z')\n`,
};
const e1108 = (deps: string[]) => check([MODULE(deps), AT], {}).diagnostics.filter((d) => d.code === "E1108");

const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

/** A scratch project of `files`, `@keel/*` linked to this repository's packages; `keel check --format=json` over it. */
function fresh(files: readonly { path: string; source: string }[]): {
  status: number | null;
  e1108: Record<string, unknown>[];
} {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "keel-deps-dropped-")));
  dirs.push(dir);
  writeFileSync(join(dir, "package.json"), '{"name":"p","private":true,"type":"module"}\n');
  for (const f of files) {
    mkdirSync(dirname(join(dir, f.path)), { recursive: true });
    writeFileSync(join(dir, f.path), f.source);
  }
  mkdirSync(join(dir, "node_modules/@keel"), { recursive: true });
  for (const pkg of readdirSync(join(repo, "packages")))
    symlinkSync(join(repo, "packages", pkg), join(dir, "node_modules/@keel", pkg));
  for (const name of ["vitest", "vite", "typescript", "fast-check"])
    symlinkSync(join(repo, "node_modules", name), join(dir, "node_modules", name));
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
    if (typeof v === "object" && v !== null && "code" in v && v.code === "E1108") found.push({ ...v });
  }
  return { status: r.status, e1108: found };
}

test(
  "after `@keel/std-temporal` has been imported, `check()` with the package in `deps` reports no E1108; with `deps` then empty, a second `check()` reports one E1108 at the call, as a fresh `keel check` does, which exits 1",
  () => {
    expect(Instant).toBeDefined();
    expect(e1108(["@keel/std-temporal"])).toEqual([]);
    const second = e1108([]);
    expect(second).toHaveLength(1);
    expect(second[0]?.path).toBe("modules/app/At.ts");
    expect(second[0]?.line).toBe(3);
    const run = fresh([MODULE([]), AT]);
    expect(run.status).toBe(1);
    expect(run.e1108).toHaveLength(1);
    expect(run.e1108[0]?.path).toBe("modules/app/At.ts");
    expect(run.e1108[0]?.line).toBe(3);
  },
  SLOW,
);

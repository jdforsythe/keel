// True when golden app 2 meets evals/tasks/golden-2/TASK.md acceptance: key files exist, the app's `check` script and
// `keel check` clean (app-scoped, so other packages' work in progress cannot fail it), the app's tests green, invariant,
// server stores and transaction properties present, unsafe count 0, every golden-2 ledger item at rung example or better
// and the ledger not regressed (backlog 0120), and the hidden renderRoute suite (acceptance.test.ts, copied into the
// app, run, and removed) passes.
import { execFile } from "node:child_process";
import { access, copyFile, readFile, readdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..", "..");
const app = join(root, "apps", "golden-2");
const ACCEPT = "test/__acceptance.test.ts";

const FILES: readonly string[] = [
  "package.json",
  "tsconfig.json",
  "tokens.ts",
  "topology.ts",
  "modules/kitchen/module.ts",
  "modules/kitchen/routes.ts",
  "modules/recipes/module.ts",
  "modules/recipes/routes.ts",
  "modules/recipes/cook.guard.ts",
  "test/api.test.ts",
  "test/routes.test.ts",
];
const SKIP_DIR = /(^|\/)(node_modules|\.keel|dist|coverage)(\/|$)/;
const CODE = /\.(ts|tsx|mts|mjs|js)$/;
const BANNED = /\bunsafe\(|@ts-ignore|@ts-expect-error|\bas any\b|:\s*any\b/;

type Run = { ok: boolean; stdout: string };

const sh = (cmd: string, args: string[], cwd = root): Promise<Run> =>
  new Promise((resolve) => {
    execFile(cmd, args, { cwd, maxBuffer: 64 * 1024 * 1024, env: { ...process.env, KEEL_AGENT: "1" } }, (err, stdout) =>
      resolve({ ok: err === null, stdout: String(stdout) }),
    );
  });

const exists = (p: string): Promise<boolean> =>
  access(p).then(
    () => true,
    () => false,
  );

/** Walks the app without descending into node_modules, .keel, dist, coverage (workspace links would loop). */
async function codeFiles(dir = "", out: string[] = []): Promise<string[]> {
  const entries = await readdir(join(app, dir), { withFileTypes: true });
  for (const e of entries) {
    const rel = dir === "" ? e.name : `${dir}/${e.name}`;
    if (SKIP_DIR.test(rel)) continue;
    if (e.isDirectory()) await codeFiles(rel, out);
    else if (CODE.test(rel)) out.push(rel);
  }
  return out.sort();
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Every golden-2 ledger item, computed now by `keel ledger --scope golden-2:` (not read from the committed ledger.json,
 * which the agent may not edit), must be at rung example or better.
 */
async function ledgerItemsProven(): Promise<boolean> {
  const r = await sh("node", [
    join(root, "packages", "cli", "src", "bin.ts"),
    "ledger",
    "--format=json",
    "--scope",
    "golden-2:",
  ]);
  const items = r.stdout
    .split("\n")
    .filter((l) => l.includes('"kind":"ledger"'))
    .map((l): unknown => JSON.parse(l));
  return items.length > 0 && items.every((e) => isRecord(e) && typeof e.rung === "string" && e.rung !== "none");
}

/** Runs the hidden renderRoute suite with the app's own vitest config, then removes the copy. */
async function acceptance(): Promise<boolean> {
  const target = join(app, ACCEPT);
  await copyFile(join(here, "acceptance.test.ts"), target);
  const r = await sh("pnpm", ["--filter", "golden-2", "exec", "vitest", "run", ACCEPT]).finally(() =>
    rm(target, { force: true }),
  );
  return r.ok;
}

export default async (): Promise<boolean> => {
  for (const f of FILES) if (!(await exists(join(app, f)))) return false;

  const files = (await codeFiles()).filter((f) => f !== ACCEPT);
  const read = (f: string): Promise<string> => readFile(join(app, f), "utf8");
  const text = new Map<string, string>();
  for (const f of files) text.set(f, await read(f));
  const all = (pick: (f: string) => boolean): string =>
    [...text]
      .filter(([f]) => pick(f))
      .map(([, t]) => t)
      .join("\n");

  if (BANNED.test(all(() => true))) return false;
  if (!all((f) => f.startsWith("modules/kitchen/")).includes("invariant(")) return false;
  if (!/\bstores:/.test(all((f) => f.startsWith("modules/kitchen/") && f.endsWith(".server.ts")))) return false;
  const tests = all((f) => f.startsWith("test/"));
  if (!tests.includes("@keel/testing")) return false;
  for (const t of ["addRecipe", "toggleFavorite"])
    if (!new RegExp(`\\bproperties\\([^;]*\\b${t}\\b`).test(tests)) return false;

  if (!(await sh("pnpm", ["--filter", "golden-2", "check"])).ok) return false;
  if (!(await sh("node", [join(root, "packages", "cli", "src", "bin.ts"), "check", "--quiet"], app)).ok) return false;
  if (!(await sh("pnpm", ["test", "--quiet", "--filter", "golden-2"])).ok) return false;
  if (!(await sh("pnpm", ["ledger", "--diff", "--scope", "golden-2:"])).ok) return false;
  if (!(await ledgerItemsProven())) return false;
  return acceptance();
};

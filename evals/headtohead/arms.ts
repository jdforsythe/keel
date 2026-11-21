// The two arms. Each starts in a fresh directory outside the repository with what a public user would have, builds
// with the stack's own command and serves with its production start. Nothing of the repository or of the hidden suite
// is copied in: the Keel arm gets the scaffold, the published skills and the packed packages; the Next.js arm gets
// create-next-app's output.
import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { access, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { ensureKit } from "../public/pack.ts";
import { setupProject } from "../public/project.ts";
import { type Served, serve } from "./serve.ts";

export type Arm = "keel" | "next";
export type Step = { ok: boolean; output: string };

const NAME = "recipe-box";

const exists = (p: string): Promise<boolean> =>
  access(p).then(
    () => true,
    () => false,
  );

/** Runs one command to its end; `output` is the last 4,000 characters of stdout and stderr. */
export function sh(
  cmd: string,
  args: readonly string[],
  cwd: string,
  env: Readonly<Record<string, string>> = {},
  timeoutMs = 600_000,
): Promise<Step> {
  return new Promise((resolve) => {
    execFile(
      cmd,
      [...args],
      {
        cwd,
        timeout: timeoutMs,
        maxBuffer: 64 * 1024 * 1024,
        env: { ...process.env, ...env, KEEL_AGENT: "1", CI: "1" },
      },
      (err, stdout, stderr) => resolve({ ok: err === null, output: `${stdout}${stderr}`.slice(-4_000) }),
    );
  });
}

/** `dir` is the project; `madeKit` is a kit this call packed (the caller removes it). */
export type Prepared = { dir: string; note: string; madeKit?: string };

/**
 * The Keel arm: the public mode's project (evals/public/project.ts) from the kit of `--keel-kit`, or from a fresh
 * pack of the repository's packages (evals/public/pack.ts) when none is given. The scaffold writes `AGENTS.md`,
 * `CLAUDE.md` and the published skills itself.
 */
async function prepareKeel(parent: string, root: string, keelKit: string | undefined): Promise<Prepared> {
  const { kit, made } = await ensureKit(root, keelKit);
  const project = await setupProject(kit, NAME, parent);
  return {
    dir: project.dir,
    note: "scaffold, published skills, packed packages",
    ...(made ? { madeKit: kit } : {}),
  };
}

async function prepareNext(parent: string, version: string): Promise<Prepared> {
  const made = await sh(
    "npx",
    [
      "--yes",
      `create-next-app@${version}`,
      NAME,
      "--ts",
      "--app",
      "--src-dir",
      "--eslint",
      "--no-tailwind",
      "--use-npm",
      "--import-alias",
      "@/*",
      "--yes",
    ],
    parent,
  );
  if (!made.ok) throw new Error(`create-next-app failed: ${made.output}`);
  return { dir: join(parent, NAME), note: `create-next-app@${version}` };
}

export const prepare = (
  arm: Arm,
  parent: string,
  root: string,
  opts: { keelKit?: string; nextVersion: string },
): Promise<Prepared> =>
  arm === "keel" ? prepareKeel(parent, root, opts.keelKit) : prepareNext(parent, opts.nextVersion);

/** The stack's build command. */
export function build(arm: Arm, dir: string): Promise<Step> {
  return arm === "keel" ? sh("pnpm", ["build"], dir) : sh("npm", ["run", "build"], dir);
}

/** The built server entry of a Keel app: the `dist/<deployable>/server.mjs` that has the client beside it, else the first. */
export async function keelEntry(dir: string): Promise<string | undefined> {
  const dist = join(dir, "dist");
  if (!(await exists(dist))) return undefined;
  const found: string[] = [];
  for (const d of (await readdir(dist)).sort()) if (await exists(join(dist, d, "server.mjs"))) found.push(d);
  for (const d of found) if (await exists(join(dist, d, "index.html"))) return join("dist", d, "server.mjs");
  const first = found[0];
  return first === undefined ? undefined : join("dist", first, "server.mjs");
}

/** Starts the built app with a fresh storage directory; the secrets are random per run. */
export async function start(arm: Arm, dir: string, scratch: string): Promise<Served> {
  const secret = randomBytes(32).toString("hex");
  if (arm === "next") return serve("npm", ["start"], dir, { NODE_ENV: "production" });
  const entry = await keelEntry(dir);
  if (entry === undefined) throw new Error("no dist/*/server.mjs after the build");
  return serve(
    "node",
    [
      "--experimental-webstorage",
      `--localstorage-file=${join(scratch, "storage")}`,
      "--disable-warning=ExperimentalWarning",
      entry,
    ],
    dir,
    { KEEL_SECRET: secret, BETTER_AUTH_SECRET: secret, AUTH_DATABASE_PATH: join(scratch, "auth.sqlite") },
  );
}

/** The version of the stack the arm ended with, for the result. */
export async function stackVersion(arm: Arm, dir: string): Promise<string> {
  const pkg: unknown = JSON.parse(await readFile(join(dir, "package.json"), "utf8").catch(() => "{}"));
  const deps = typeof pkg === "object" && pkg !== null ? Reflect.get(pkg, "dependencies") : undefined;
  const name = arm === "next" ? "next" : "@keel/server";
  const v = typeof deps === "object" && deps !== null ? Reflect.get(deps, name) : undefined;
  return `${name}@${typeof v === "string" ? v : "unknown"}`;
}

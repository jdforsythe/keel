// The two arms. Each starts in a fresh directory outside the repository with what a public user would have, builds
// with the stack's own command and serves with its production start. Nothing of the repository or of the hidden suite
// is copied in: the Keel arm gets the scaffold, the published skills and the packed packages; the Next.js arm gets
// create-next-app's output.
import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { access, cp, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
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

export type Prepared = { dir: string; note: string };

/** `keelKit` holds the packed `@keel/*` tarballs the scaffold's `^0.0.0` ranges resolve to until they are published. */
async function prepareKeel(parent: string, root: string, keelKit: string | undefined): Promise<Prepared> {
  const dir = join(parent, NAME);
  const scaffold = await sh(
    "node",
    [join(root, "packages", "cli", "src", "bin.ts"), "scaffold", "project", NAME],
    parent,
  );
  if (!scaffold.ok) throw new Error(`scaffold failed: ${scaffold.output}`);
  await cp(join(root, "packages", "cli", "skills"), join(dir, ".claude", "skills"), { recursive: true });
  const note = "Keel skills are in .claude/skills; read keel/SKILL.md first, then load the skill each task names.\n";
  await writeFile(join(dir, "AGENTS.md"), note);
  await writeFile(join(dir, "CLAUDE.md"), note);
  if (keelKit === undefined) throw new Error("the keel arm needs --keel-kit <dir> holding the packed @keel/* tarballs");
  const overrides = (await readdir(keelKit))
    .filter((f) => /^keel-.+\.tgz$/.test(f))
    .map((f) => `  "@keel/${f.replace(/^keel-/, "").replace(/-\d.*\.tgz$/, "")}": "file:${join(keelKit, f)}"`);
  await writeFile(join(dir, "pnpm-workspace.yaml"), `overrides:\n${overrides.join("\n")}\n`);
  const install = await sh("pnpm", ["install"], dir);
  if (!install.ok) throw new Error(`install failed: ${install.output}`);
  return { dir, note: "scaffold, published skills, packed packages" };
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

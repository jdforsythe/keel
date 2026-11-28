// Shared fixture for the k.evaluator conformance files (not a test file). Public surface only: the `keel` binary over the household copy of derived-support.ts.
// Seed 1337 for every property in this suite.
// `G` is the fixture of k.compiler's E1050 clauses: the household copy whose `modules/setup/gate.guard.ts` imports a package `p` under `node_modules`, `p`'s `index.mjs` as each case gives;
// `p` default-exports a value the guard's redirect reads (`members.signin` while it is `"1"`, else `app.start`), which `.keel/routes.json` holds (k.router Artifacts).
import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { request } from "node:http";
import { testTime } from "@keel/tooling/test-time";
import { tempDir } from "@keel/tooling/test-tmp";
import { type Raw, pkg } from "./derived-cache-loader-support.ts";
import { guardFile } from "./derived-cache-observed-support.ts";
import { BIN, type Out, type Tree, canConnect, childEnv, freePort, parseOut, until } from "./derived-support.ts";

/** The redirect `routes.json` holds while `p` gives `"1"`. */
export const SIGNIN = "members.signin";
export const START = "app.start";

/** Writes `p` (its `index.mjs` is `code`, its default export `unknown`) and binds the guard file to it; `redirect` reads the default export as `v`. */
export function gFixture(t: Tree, code: string, redirect = `String(v) === "1" ? "${SIGNIN}" : "${START}"`): void {
  pkg(t, "p", "index.mjs", code, "declare const v: unknown;\nexport default v;\n");
  guardFile(t, 'import v from "p";', redirect);
}

/** Each diagnostic record of `code` in a json run, whole. */
export function recordsOf(out: Out, code: string): Raw[] {
  const found: Raw[] = [];
  for (const row of out.stdout.split("\n")) {
    if (!row.startsWith("{")) continue;
    const v: unknown = JSON.parse(row);
    if (typeof v !== "object" || v === null || Reflect.get(v, "code") !== code) continue;
    const rec: Raw = {};
    for (const k of Object.keys(v)) rec[k] = Reflect.get(v, k);
    found.push(rec);
  }
  return found;
}

/** The message of a record, `""` when it has none. */
export const text = (r: Raw | undefined): string => {
  const m = r?.message;
  return typeof m === "string" ? m : "";
};

/** `keel <args>` in `dir`, killed (the child this call spawned) when it has not ended in `ms` (the time bound goes through `testTime`). */
export function keelBounded(
  dir: string,
  args: readonly string[],
  ms: number,
  env: Readonly<Record<string, string>> = {},
): Out {
  const withFormat = args.some((a) => a.startsWith("--format")) ? [...args] : [...args, "--format=json"];
  const r = spawnSync(process.execPath, [BIN, ...withFormat], {
    cwd: dir,
    encoding: "utf8",
    env: childEnv(env),
    timeout: testTime(ms),
    killSignal: "SIGKILL",
  });
  return parseOut(r.status, r.stdout, r.stderr);
}

/** A `keel dev` this file started: its own process group, killed by `stop`, which resolves once the child has exited; a second `stop` awaits the first. */
export type Dev = { port: number; child: ChildProcess; output: () => string; stop: () => Promise<void> };

/** The environment the household app's server needs to stay up (`members.secret`, k.members): two secrets of 32 or more characters. */
export const HOUSEHOLD_ENV: Readonly<Record<string, string>> = {
  KEEL_SECRET: "keel-evaluator-conformance-secret-0123456789",
  BETTER_AUTH_SECRET: "keel-evaluator-conformance-auth-secret-0123456789",
  KEEL_POSTGRES_URL: "pglite:data/postgres",
};

/**
 * Starts `keel dev` in `dir` on a free port (with `env` added) and resolves once it listens (or after `ms`).
 * The child's `TMPDIR` is a folder of its own (`tempDir`, removed when the test file ends): `stop` kills the child with
 * SIGKILL, which no process can clean up after, and the spec promises no removal then (k.evaluator Not held: "A command
 * killed outright (`SIGKILL`) while its evaluator runs a loop that never yields leaves that process running."), so the
 * evaluator folders a killed `keel dev` left go with that folder, not with a glob over the run's temp folder.
 * ASSUMED: `keel dev` makes its evaluator folders under `os.tmpdir()`, which follows `TMPDIR`.
 */
export async function startDev(
  dir: string,
  ms: number,
  env: Readonly<Record<string, string>> = HOUSEHOLD_ENV,
): Promise<Dev> {
  const port = await freePort();
  let out = "";
  const child = spawn(process.execPath, [BIN, "dev", "--port", String(port)], {
    cwd: dir,
    env: childEnv({ ...env, TMPDIR: tempDir("evaluator-dev-") }),
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout?.on("data", (b: Buffer) => {
    out += b.toString("utf8");
  });
  child.stderr?.on("data", (b: Buffer) => {
    out += b.toString("utf8");
  });
  const exited = new Promise<void>((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) resolve();
    else child.once("exit", () => resolve());
  });
  await until(() => canConnect(port), testTime(ms));
  let stopping: Promise<void> | undefined;
  return {
    port,
    child,
    output: () => out,
    stop: () => {
      stopping ??= killGroup(child, exited);
      return stopping;
    },
  };
}

/** SIGKILLs the process group of `child` (which this file spawned, `detached`) once, then waits for `child` to exit. */
async function killGroup(child: ChildProcess, exited: Promise<void>): Promise<void> {
  const ended = child.exitCode !== null || child.signalCode !== null;
  if (child.pid !== undefined) {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch (e) {
      // ESRCH: no process is left in the group; EPERM after the leader ended: macOS's answer for a group of zombies
      const code: unknown = typeof e === "object" && e !== null ? Reflect.get(e, "code") : undefined;
      if (!(code === "ESRCH" || (ended && code === "EPERM"))) throw e;
    }
  }
  await exited;
}

/** A `GET` of `path`: the status and body, `undefined` when nothing answered. */
export function get(port: number, path: string): Promise<{ status: number; body: string } | undefined> {
  return new Promise((resolve) => {
    const req = request({ host: "127.0.0.1", port, path, method: "GET" }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (c: string) => {
        body += c;
      });
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req.on("error", () => resolve(undefined));
    req.end();
  });
}

// Shared by restart.mjs, workflow.mjs and workflow-postgres.mjs: a copy of apps/golden-1 in a temporary folder, built with `keel build`, its
// `dist/api/server.mjs` served on a SQLite file in that folder (or a Postgres URL), and the stored rows read back with node:sqlite.
// Nothing here prints a database URL or a stored value; every child is stopped by the caller's `finally`.
import { execFile, spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { cp, symlink } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath, pathToFileURL } from "node:url";

export const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const app = join(root, "apps", "golden-1");
const cli = join(root, "packages", "cli", "src", "bin.ts");
const SECRET = "golden-1-smoke-secret-of-32-bytes-or-more";
const SKIP = new Set(["node_modules", "dist", ".keel", ".keel-dev", ".turbo", "reports", ".api.storage"]);

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Captured output of the processes a smoke started, by label; each value is the live array its reader appends to. */
const kept = new Map();
const KEEP_TAIL = 200;

/** Keep `lines` (a child's captured stdout and stderr, still growing) for the file a crash or a failed step writes. */
export function keepOutput(label, lines) {
  let name = label;
  for (let n = 2; kept.has(name); n++) name = `${label}#${n}`;
  kept.set(name, lines);
}

/**
 * Write the error's stack and the tail of every kept log to a file in the temporary folder, outside the repository and
 * not removed by a smoke's cleanup; returns its path, or undefined when nothing could be written.
 */
function writeKept(name, stack) {
  try {
    const dir = join(tmpdir(), "keel-smoke");
    mkdirSync(dir, { recursive: true });
    const file = join(dir, `${name}-${process.pid}-${Date.now()}.log`);
    const parts = [stack === undefined ? "" : `error\n${stack}\n`];
    for (const [label, lines] of kept)
      parts.push(`${label} (last ${KEEP_TAIL} of ${lines.length} lines)\n${lines.slice(-KEEP_TAIL).join("\n")}\n`);
    writeFileSync(file, parts.join("\n"));
    return file;
  } catch {
    return undefined;
  }
}

/** A step recorder: `step(label, pass, detail)`, and `finish(name)` prints the lines and the trailer. */
export function recorder() {
  const lines = [];
  const t0 = Date.now();
  let failed = 0;
  let finished = false;
  let fault;
  /** The line that names the file holding the error and the children's output tail; empty when none was written. */
  const keptLine = (name) => {
    const file = writeKept(name, fault);
    return file === undefined ? [] : [`  output: ${file}`];
  };
  // A crash (an uncaught error, a rejection nobody awaited, an exit before `finish`) keeps and prints the steps so far.
  const crashed = (why) => {
    if (finished) return;
    finished = true;
    for (const l of lines) console.log(l);
    for (const l of keptLine("crashed")) console.log(l);
    console.log(`fail crashed after ${lines.length} steps: ${why}`);
    process.exitCode = 1;
  };
  process.on("uncaughtException", (e) => {
    fault = String(e?.stack ?? e);
    crashed(
      String(e?.stack ?? e)
        .split("\n")
        .slice(0, 3)
        .join(" | "),
    );
    process.exit(1);
  });
  process.on("unhandledRejection", (e) => {
    fault = String(e?.stack ?? e);
    crashed(
      String(e?.stack ?? e)
        .split("\n")
        .slice(0, 3)
        .join(" | "),
    );
    process.exit(1);
  });
  process.on("exit", (code) => crashed(`exit ${code} before the last line`));
  return {
    step(label, pass, detail = "") {
      if (!pass) failed++;
      lines.push(`${pass ? "ok" : "fail"} ${label}${detail === "" ? "" : ` ${detail}`}`);
    },
    /** The error a script caught and turned into a failed step: its whole stack goes to the kept file. */
    caught(e) {
      fault = String(e?.stack ?? e);
    },
    finish(name) {
      finished = true;
      for (const l of lines) console.log(l);
      if (failed > 0 || fault !== undefined) for (const l of keptLine(name)) console.log(l);
      console.log(
        `${failed === 0 ? "ok" : "fail"} ${name} ${lines.length} steps, ${failed} failed (${((Date.now() - t0) / 1000).toFixed(1)}s)`,
      );
      process.exitCode = failed === 0 ? 0 : 1;
    },
  };
}

export const freePort = () =>
  new Promise((resolve, reject) => {
    const s = createServer();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const a = s.address();
      s.close(() => resolve(typeof a === "object" && a !== null ? a.port : 0));
    });
  });

/** Copy the app at `from` (apps/golden-1 when left out) into `dir` (a temporary folder). */
export async function copyApp(dir, from = app) {
  // No `test/`: `keel build` checks first, and the tests' `vitest` resolves from the workspace root, not from the copy.
  const tests = join(from, "test");
  await cp(from, dir, {
    recursive: true,
    filter: (src) => src === from || (src !== tests && !SKIP.has(basename(src))),
  });
  await symlink(join(from, "node_modules"), join(dir, "node_modules"), "dir");
}

/** Copy apps/golden-1 into `dir` and build it there; resolves to whether the build passed. */
export async function buildCopy(dir) {
  await copyApp(dir);
  return buildIn(dir);
}

/** `keel build` in `dir`; resolves to whether it passed. */
export function buildIn(dir) {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [cli, "build"],
      { cwd: dir, env: { ...process.env, KEEL_AGENT: "1" }, maxBuffer: 64 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err !== null) keepOutput(`build ${basename(dir)}`, `${stdout}\n${stderr}`.split("\n"));
        resolve(err === null);
      },
    );
  });
}

/**
 * Start the built api of `dir` at `port` on `file`: an absolute SQLite path, or a `postgres:` URL given as it is;
 * `stop()` kills it. Its output is kept in `log`.
 */
export function serve(dir, file, port) {
  const database = file.startsWith("postgres:") ? file : pathToFileURL(file).href;
  const child = spawn(
    process.execPath,
    ["--disable-warning=ExperimentalWarning", join(dir, "dist", "api", "server.mjs")],
    {
      cwd: dir,
      env: { ...process.env, PORT: String(port), KEEL_SECRET: SECRET, KEEL_DATABASE_URL: database },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const log = [];
  for (const out of [child.stdout, child.stderr]) out.on("data", (d) => log.push(...String(d).trim().split("\n")));
  keepOutput(`serve ${basename(dir)} :${port}`, log);
  const exited = new Promise((resolve) => child.once("exit", resolve));
  return {
    child,
    log,
    exited,
    async kill(signal = "SIGKILL") {
      if (child.exitCode === null && child.signalCode === null) child.kill(signal);
      await Promise.race([exited, wait(10_000)]);
    },
  };
}

/** Stop `proc` with SIGKILL, whatever its state. */
export async function stop(proc) {
  if (proc === undefined) return;
  await proc.kill("SIGKILL");
}

const headers = { accept: "application/json", "content-type": "application/json", "x-keel": "1" };
export const get = (base, path) =>
  fetch(`${base}${path}`, { headers: { accept: "application/json" } }).then(
    async (r) => ({ status: r.status, body: await r.json().catch(() => null) }),
    () => ({ status: 0, body: null }),
  );
export const post = (base, path, body = {}) =>
  fetch(`${base}${path}`, { method: "POST", headers, body: JSON.stringify(body) }).then(
    (r) => r.status,
    () => 0,
  );

/** Poll `GET /api/lists` for 200, at most `ms`. */
export async function ready(base, ms = 20_000) {
  for (const end = Date.now() + ms; Date.now() < end; ) {
    if ((await get(base, "/api/lists")).status === 200) return true;
    await wait(100);
  }
  return false;
}

export const field = (v, ...keys) => keys.reduce((o, k) => (typeof o === "object" && o !== null ? o[k] : undefined), v);
/** The `api.lists` value of a `GET /api/lists` body. */
export const view = (body) => field(body, "results", "api.lists", "value");

/** The stored text of key `key`, read from the database file as it is on disk (read-only); undefined when absent. */
export function row(file, key) {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    const r = db.prepare("SELECT value FROM keel_kv WHERE key = ?").get(key);
    return typeof r?.value === "string" ? r.value : undefined;
  } catch {
    return undefined;
  } finally {
    db.close();
  }
}
export const BOARD_KEY = "keel.store.api.board";
export const REMOVAL_KEY = "keel.store.api.removal";

// Shared by restart.mjs and workflow.mjs: a copy of apps/golden-1 in a temporary folder, built with `keel build`, its
// `dist/api/server.mjs` served on a SQLite file in that folder, and the stored rows read back with node:sqlite.
// Nothing here prints a database URL or a stored value; every child is stopped by the caller's `finally`.
import { execFile, spawn } from "node:child_process";
import { cp, symlink } from "node:fs/promises";
import { createServer } from "node:net";
import { basename, dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath, pathToFileURL } from "node:url";

export const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const app = join(root, "apps", "golden-1");
const cli = join(root, "packages", "cli", "src", "bin.ts");
const SECRET = "golden-1-smoke-secret-of-32-bytes-or-more";
const SKIP = new Set(["node_modules", "dist", ".keel", ".keel-dev", ".turbo", "reports", ".api.storage"]);

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** A step recorder: `step(label, pass, detail)`, and `finish(name)` prints the lines and the trailer. */
export function recorder() {
  const lines = [];
  const t0 = Date.now();
  let failed = 0;
  return {
    step(label, pass, detail = "") {
      if (!pass) failed++;
      lines.push(`${pass ? "ok" : "fail"} ${label}${detail === "" ? "" : ` ${detail}`}`);
    },
    finish(name) {
      for (const l of lines) console.log(l);
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
  await cp(from, dir, { recursive: true, filter: (src) => src === from || !SKIP.has(basename(src)) });
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
      (err) => resolve(err === null),
    );
  });
}

/** Start the built api of `dir` on `file` (an absolute path) at `port`; `stop()` kills it. Its output is kept in `log`. */
export function serve(dir, file, port) {
  const child = spawn(
    process.execPath,
    ["--disable-warning=ExperimentalWarning", join(dir, "dist", "api", "server.mjs")],
    {
      cwd: dir,
      env: { ...process.env, PORT: String(port), KEEL_SECRET: SECRET, KEEL_DATABASE_URL: pathToFileURL(file).href },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const log = [];
  for (const out of [child.stdout, child.stderr]) out.on("data", (d) => log.push(...String(d).trim().split("\n")));
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

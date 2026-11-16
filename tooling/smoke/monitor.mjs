// Production tallies for golden-1: build a copy of the app whose `readers` holds a fresh reader, serve its production
// entry on a local port, drive the two-user board script in Chromium, wait for one tally merge, then run
// `keel session monitor`, which writes apps/golden-1/.keel/monitored.json. The server and the copy are removed after.
// Usage: node tooling/smoke/monitor.mjs  (SMOKE_PORT, default 4196; SMOKE_OUT, default apps/golden-1/.keel/monitored.json).
// Needs Playwright's Chromium (`pnpm exec playwright install chromium`). Compact output (docs/OUTPUT.md).
import { execFile, spawn } from "node:child_process";
import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import { cp, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const app = join(root, "apps", "golden-1");
const cli = join(root, "packages", "cli", "src", "bin.ts");
const port = Number(process.env.SMOKE_PORT ?? 4196);
const origin = `http://127.0.0.1:${port}`;
const out = process.env.SMOKE_OUT ?? join(app, ".keel", "monitored.json");
const MERGE_WAIT_MS = 90_000;
const SKIP = new Set(["node_modules", "dist", ".keel", ".keel-dev", ".turbo", ".api.storage"]);

const lines = [];
let failed = 0;
const step = (label, pass, detail = "") => {
  if (!pass) failed++;
  lines.push(`${pass ? "ok" : "fail"} ${label}${detail === "" ? "" : ` ${detail}`}`);
};
const t0 = Date.now();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const run = (args, cwd, env = {}) =>
  new Promise((resolve) => {
    execFile("node", args, { cwd, env: { ...process.env, ...env }, maxBuffer: 16 * 1024 * 1024 }, (err, stdout) =>
      resolve({ ok: err === null, stdout: String(stdout).trim() }),
    );
  });

// A reader the server will admit: a caller token signed under KEEL_SECRET, hashed as the server hashes a caller cookie.
const secret = randomBytes(32).toString("base64url");
const token = randomUUID();
const cookie = `${token}.${createHmac("sha256", secret).update(token).digest("base64url")}`;
const reader = createHash("sha256").update(cookie).digest("base64url");

const copy = await mkdtemp(join(root, "apps", ".golden-1-monitor-"));
// The api stores its state in SQLite: a file in a temporary folder outside the repo, removed after.
const data = await mkdtemp(join(tmpdir(), "keel-smoke-monitor-"));
let server;
try {
  await cp(app, copy, { recursive: true, filter: (src) => !SKIP.has(basename(src)) });
  await symlink(join(app, "node_modules"), join(copy, "node_modules"), "dir");
  const manifest = join(copy, "modules", "api", "module.ts");
  const src = await readFile(manifest, "utf8");
  const withReader = src.replace(/readers: \[[^\]]*\]/, `readers: [${JSON.stringify(reader)}]`);
  step("reader", withReader !== src, reader.slice(0, 8));
  await writeFile(manifest, withReader);
  const build = await run([cli, "build"], copy);
  step("build", build.ok, build.stdout.split("\n").at(-1));
  if (!build.ok) throw new Error("build failed");

  server = spawn("node", ["--disable-warning=ExperimentalWarning", join(copy, "dist", "api", "server.mjs")], {
    cwd: copy,
    env: {
      ...process.env,
      PORT: String(port),
      KEEL_SECRET: secret,
      KEEL_ORIGIN: origin,
      KEEL_DATABASE_URL: pathToFileURL(join(data, "keel.sqlite")).href,
    },
  });
  const serverLog = [];
  server.stdout.on("data", (d) => serverLog.push(...String(d).trim().split("\n")));
  server.stderr.on("data", (d) => serverLog.push(...String(d).trim().split("\n")));
  server.on("exit", (code, signal) => serverLog.push(`exit ${code} ${signal}`));
  process.on("exit", () => {
    if (failed > 0) for (const l of serverLog.slice(-8)) console.log(`api ${l}`);
  });
  const listening = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), 20_000);
    server.stdout.on("data", (d) => {
      if (String(d).includes("listening")) {
        clearTimeout(timer);
        resolve(true);
      }
    });
    server.on("exit", () => resolve(false));
  });
  step("serve", listening, origin);
  if (!listening) throw new Error("server did not listen");

  const b = await chromium.launch();
  let u0url = () => "";
  let u1url = () => "";
  let shown = async () => "";
  try {
    const c0 = await b.newContext();
    const c1 = await b.newContext();
    const u0 = await c0.newPage();
    const u1 = await c1.newPage();
    const errors = [];
    u0url = () => u0.url();
    u1url = () => u1.url();
    shown = () => u0.locator("body").innerText();
    for (const p of [u0, u1]) p.on("pageerror", (e) => errors.push(String(e).split("\n")[0]));
    const done = (p, title) => p.getByRole("checkbox", { name: `Done: ${title}` });
    const addTodo = async (p, title) => {
      await p.getByLabel("Title").fill(title);
      await p.click("#todos\\.addTodo");
      await done(p, title).waitFor({ timeout: 5000 });
    };
    // User 0 makes the board: Home with Milk and Bread.
    // The board stream stays open, so a page never goes network-idle: wait for the board to show Live.
    const live = (p) => p.locator("#todos\\.live", { hasText: "Live" }).waitFor({ timeout: 10_000 });
    await u0.goto(`${origin}/`, { waitUntil: "load" });
    await live(u0);
    await u0.getByLabel("List name").fill("Home");
    await u0.click("#todos\\.addList");
    await u0.locator("#todos\\.main").getByRole("link", { name: "Home", exact: true }).click();
    await u0.locator("#todos\\.list\\.title", { hasText: "Home" }).waitFor({ timeout: 5000 });
    await addTodo(u0, "Milk");
    await addTodo(u0, "Bread");
    const list = u0.url();
    step("board", true, new URL(list).pathname);
    // Both on the list; user 0 marks Milk done and user 1 sees it with no input of its own.
    await u1.goto(list, { waitUntil: "load" });
    await live(u1);
    await done(u0, "Milk").click();
    let seen = false;
    for (let i = 0; i < 50 && !seen; i++) {
      seen = await done(u1, "Milk").isChecked();
      if (!seen) await wait(100);
    }
    step("live toggle", seen);
    // User 1 opens Milk's edit page, goes offline, saves priority high and marks Bread done: both wait.
    await u1.getByRole("link", { name: "Edit Milk" }).click();
    await u1.locator("#todos\\.save").waitFor({ timeout: 5000 });
    await c1.setOffline(true);
    await u1.getByLabel("Priority").selectOption("high");
    await u1.click("#todos\\.save");
    await done(u1, "Bread").waitFor({ timeout: 5000 });
    await done(u1, "Bread").click();
    step("offline writes", (await u1.locator("#todos\\.outbox").count()) === 1);
    // User 0 renames Milk to Oat milk and adds Eggs.
    await u0.getByRole("link", { name: "Edit Milk" }).click();
    await u0.locator("#todos\\.save").waitFor({ timeout: 5000 });
    await u0.getByLabel("Title").fill("Oat milk");
    await u0.click("#todos\\.save");
    await done(u0, "Oat milk").waitFor({ timeout: 5000 });
    await addTodo(u0, "Eggs");
    step("rename and add", true);
    // User 1 comes back: the toggle lands, the edit is refused; Keep theirs drops it.
    await c1.setOffline(false);
    const theirs = u1.getByRole("button", { name: "Keep theirs" });
    await theirs.waitFor({ timeout: 10_000 });
    await theirs.click();
    await u1.locator("#todos\\.outbox").waitFor({ state: "detached", timeout: 5000 });
    step("conflict kept theirs", true);
    for (const e of errors) step("pageerror", false, e);
  } catch (e) {
    step("script", false, `${String(e).split("\n")[0]} at ${lines.length} steps; ${u0url()} ${u1url()}`);
    step("page text", false, (await shown()).replace(/\s+/g, " ").slice(0, 400));
  } finally {
    await b.close();
  }

  // One merge: the runner writes `sessions.tally` every 60 s of the server's clock.
  const deadline = Date.now() + MERGE_WAIT_MS;
  let merged = false;
  let lastError = "";
  while (!merged && Date.now() < deadline) {
    await wait(2000);
    const res = await fetch(`${origin}/sessions/tally`, {
      headers: { accept: "application/json", cookie: `keel-caller=${cookie}` },
    }).catch((e) => {
      lastError = String(e.cause?.code ?? e.cause?.message ?? e.message);
      return undefined;
    });
    const body = res?.ok ? await res.json() : undefined;
    const tally = body?.results?.["sessions.tally"]?.value ?? body?.value ?? body;
    merged = tally !== undefined && Object.keys(tally.tx ?? {}).length > 0;
    if (!merged && Date.now() >= deadline - 2000)
      step("tally body", false, `${res?.status ?? lastError} ${JSON.stringify(body)}`);
  }
  step("tally merged", merged, `${Math.round((Date.now() - t0) / 1000)}s`);

  const monitor = await run([cli, "session", "monitor", origin, "--out", out], root, { KEEL_SESSIONS_TOKEN: cookie });
  const said = monitor.stdout.split("\n");
  step("session monitor", monitor.ok, monitor.ok ? said[0].replace(/^ok session monitor /, "") : said.join(" | "));
} catch (e) {
  step("flow", false, String(e).split("\n")[0]);
} finally {
  if (server !== undefined && server.exitCode === null) {
    const exited = new Promise((r) => server.on("exit", r));
    server.kill("SIGTERM");
    await Promise.race([exited, wait(10_000)]);
    if (server.exitCode === null) server.kill("SIGKILL");
  }
  await rm(copy, { recursive: true, force: true });
  await rm(data, { recursive: true, force: true });
}
for (const l of lines) console.log(l);
const secs = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`${failed === 0 ? "ok" : "fail"} monitor ${lines.length} steps, ${failed} failed (${secs}s)`);
process.exitCode = failed === 0 ? 0 : 1;

// Inspector proof: a copy of golden-1 runs under `keel dev` on a free port, in its own process group; headless Chromium
// opens it and adds a list, which makes the dev entry report its live graph and stores to `/__keel/inspect`; the built
// `apps/inspector` (served here as static files on another free port, its origin listed in `KEEL_INSPECT_ORIGINS`) is
// opened at `?url=<golden-1>` and shows the live graph (nodes grouped by kind), the store `todos.outbox` with the
// queued write of the added list in its log, the ids view, and no error; neither page raises a page error or a console error. The page waits for
// the report to arrive at the inspect route and for the inspector's own elements, never for an idle network or a fixed time.
// Usage: node --disable-warning=ExperimentalWarning tooling/smoke/inspector.mjs [png] (after `pnpm build`). Nothing is
// written inside the repo; the dev server, the file server and the browser are stopped on every path.
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join, normalize } from "node:path";
import { chromium } from "@playwright/test";
import { copyApp, freePort, keepOutput, recorder, root, wait } from "./built.mjs";

const LIMIT_MS = 180_000;
const cli = join(root, "packages", "cli", "src", "bin.ts");
const dist = join(root, "apps", "inspector", "dist");
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".json": "application/json",
};
const { step, finish, caught } = recorder();
const tmp = await mkdtemp(join(tmpdir(), "keel-smoke-inspector-"));
const errors = [];
let dev;
let files;
let browser;

/** SIGKILL the dev server's process group (the child and whatever it started). */
function killGroup() {
  if (dev?.child.pid === undefined) return;
  try {
    process.kill(-dev.child.pid, "SIGKILL");
  } catch {
    // The group is already gone.
  }
}
process.on("exit", killGroup);
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    killGroup();
    process.exit(130);
  });
}
const limit = setTimeout(() => {
  killGroup();
  step("time limit", false, `${LIMIT_MS / 1000}s`);
  finish("inspector");
  process.exit(1);
}, LIMIT_MS);

/** Poll `fn` every 200 ms until it answers something other than undefined, at most `ms`. */
async function until(fn, ms) {
  for (const end = Date.now() + ms; Date.now() < end; await wait(200)) {
    const v = await fn();
    if (v !== undefined) return v;
  }
  return undefined;
}

try {
  const inspectorPort = await freePort();
  const devPort = await freePort();
  const target = `http://127.0.0.1:${devPort}`;
  const inspector = `http://127.0.0.1:${inspectorPort}`;

  // The built inspector, as static files.
  files = createServer(async (req, res) => {
    const path = normalize(new URL(req.url ?? "/", inspector).pathname);
    const file = join(dist, path === "/" || path.includes("..") ? "index.html" : path);
    const body = await readFile(file).catch(() => undefined);
    res.writeHead(body === undefined ? 404 : 200, {
      "content-type": types[extname(file)] ?? "application/octet-stream",
    });
    res.end(body);
  });
  await new Promise((resolve) => files.listen(inspectorPort, "127.0.0.1", resolve));
  step("inspector served", (await readFile(join(dist, "index.html"), "utf8").catch(() => "")) !== "");

  await copyApp(join(tmp, "app"));
  const child = spawn(
    process.execPath,
    ["--disable-warning=ExperimentalWarning", cli, "dev", "--port", String(devPort)],
    {
      cwd: join(tmp, "app"),
      env: { ...process.env, KEEL_AGENT: "1", KEEL_INSPECT_ORIGINS: inspector },
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
    },
  );
  const log = [];
  for (const out of [child.stdout, child.stderr]) out.on("data", (d) => log.push(...String(d).trim().split("\n")));
  keepOutput("keel dev", log);
  dev = { child, log };
  const reported = () =>
    fetch(`${target}/__keel/inspect`).then(
      (r) => (r.status === 200 ? r.json() : undefined),
      () => undefined,
    );
  const up = (await until(reported, 60_000)) !== undefined;
  step("dev serve", up);
  if (!up) throw new Error(`dev server did not answer: ${log.slice(-3).join(" | ")}`);

  browser = await chromium.launch();
  const watch = (p, tag) => {
    keepOutput(`${tag} errors`, errors);
    p.on("console", (m) => {
      if (m.type() === "error") errors.push(`${tag}: ${m.text()}`);
    });
    p.on("pageerror", (e) => errors.push(`${tag}: ${String(e)}`));
  };

  const app = await browser.newPage();
  watch(app, "golden-1");
  await app.goto(`${target}/`, { waitUntil: "load" });
  await app.getByLabel("List name").fill("Groceries");
  await app.click("#todos\\.addList");
  await app.getByRole("link", { name: "Groceries", exact: true }).waitFor({ timeout: 10_000 });
  step("add list", true);

  // The dev entry reports after mount and at most once a second: wait for a report holding the list.
  const doc = await until(async () => {
    const d = await reported();
    return d?.live === true && (d.stores?.["todos.outbox"]?.log?.length ?? 0) > 0 ? d : undefined;
  }, 30_000);
  step("reported", doc !== undefined, doc === undefined ? "no live report with an outbox entry" : "");

  const p = await browser.newPage();
  watch(p, "inspector");
  await p.goto(`${inspector}/?url=${encodeURIComponent(target)}`, { waitUntil: "load" });
  await p.locator("#inspector\\.graph, [id='inspector.error.message']").first().waitFor({ timeout: 15_000 });
  const view = await p.evaluate(() => {
    const text = (id) => document.getElementById(id)?.innerText ?? null;
    const items = (id) => [...(document.getElementById(id)?.querySelectorAll("li") ?? [])].map((li) => li.innerText);
    const groups = [...document.querySelectorAll("[id^='inspector.graph.'][id$='.title']")]
      .filter((h) => h.id !== "inspector.graph.title")
      .map((h) => h.innerText);
    return {
      live: text("inspector.live"),
      graphCounts: text("inspector.graph.counts"),
      groups,
      storeCount: text("inspector.store.todos.outbox.count"),
      log: items("inspector.store.todos.outbox.log"),
      idsCounts: text("inspector.ids.counts"),
      ids: items("inspector.ids.list"),
      error: text("inspector.error.message"),
    };
  });
  step("no inspector error", view.error === null, String(view.error ?? ""));
  step("live", view.live !== null && !/not live|offline/i.test(view.live), String(view.live));
  step(
    "graph",
    view.groups.length > 0 && view.graphCounts !== null,
    `${view.groups.length} kinds, ${view.graphCounts}`,
  );
  step(
    "store todos.outbox",
    view.log.length > 0 && view.log.some((l) => l.includes("outbox.add")),
    `${view.storeCount}`,
  );
  step("ids", view.ids.length > 0, String(view.idsCounts));
  if (process.argv[2] !== undefined) await p.screenshot({ path: process.argv[2], fullPage: true });
  step("no page error", errors.length === 0, errors.map((e) => e.split("\n")[0]).join(" | "));
} catch (e) {
  caught(e);
  step("flow", false, String(e).split("\n")[0]);
} finally {
  clearTimeout(limit);
  await browser?.close().catch(() => undefined);
  killGroup();
  await new Promise((resolve) => (files === undefined ? resolve() : files.close(resolve)));
  await rm(tmp, { recursive: true, force: true });
}
finish("inspector");

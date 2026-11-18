// Resume proof for a served golden-1 page in a real browser: build a copy whose `web` deployable is a `node` server,
// serve its api on a SQLite file and the web server on free ports, seed a list with two todos, load the list page in
// headless Chromium and check that resume left the served page in place: no console warning or error, no element
// removed after the parser finished, every served element still in the document, each todo row the very element the
// server sent; then a click on a todo's Done checkbox posts the toggle and shows it checked.
// Usage: node tooling/smoke/resume.mjs [runs] (default 1). Nothing is written inside the repo.
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { buildIn, copyApp, field, freePort, get, post, ready, recorder, serve, stop, view, wait } from "./built.mjs";

const SECRET = "golden-1-smoke-secret-of-32-bytes-or-more";

/** Start the built `web` server of `dir` at `port`, its `api` peer at `api`. */
function serveWeb(dir, port, api) {
  const child = spawn(
    process.execPath,
    ["--disable-warning=ExperimentalWarning", join(dir, "dist", "web", "server.mjs")],
    {
      cwd: dir,
      env: { ...process.env, PORT: String(port), KEEL_SECRET: SECRET, KEEL_PEER_API: api },
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
    async kill() {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
      await Promise.race([exited, wait(10_000)]);
    },
  };
}

/** Before any script runs: at the end of parsing, keep every served element and count every element removed after. */
function watch() {
  const k = { served: [], rows: {}, removed: 0 };
  Reflect.set(window, "__keelSmoke", k);
  document.addEventListener("readystatechange", () => {
    if (document.readyState !== "interactive" || k.served.length > 0) return;
    k.served = [...document.body.querySelectorAll("*")];
    for (const row of document.querySelectorAll('[id^="todos.row."]')) k.rows[row.id] = row;
    new MutationObserver((records) => {
      for (const r of records) for (const n of r.removedNodes) if (n.nodeType === 1) k.removed++;
    }).observe(document, { childList: true, subtree: true });
  });
}

const runs = Number(process.argv[2] ?? "1");
const { step, finish } = recorder();
const tmp = await mkdtemp(join(tmpdir(), "keel-smoke-resume-"));
let api;
let web;
let browser;
try {
  const dir = join(tmp, "app");
  await copyApp(dir);
  // The page is served, not mounted: `web` becomes a node deployable reaching `api` as its peer.
  const topo = join(dir, "topology.ts");
  const source = await readFile(topo, "utf8");
  const node = source.replace(
    /web: \{[\s\S]*?\n {2}\},\n {2}api:/,
    'web: { modules: ["todos"], adapter: "node" },\n  api:',
  );
  await writeFile(topo, node);
  step("topology", node !== source);
  step("build", await buildIn(dir));
  await mkdir(join(tmp, "data"));
  const apiPort = await freePort();
  const apiBase = `http://127.0.0.1:${apiPort}`;
  const webPort = await freePort();
  const webBase = `http://127.0.0.1:${webPort}`;
  // Each deployable names the other as its peer.
  process.env.KEEL_PEER_WEB = webBase;
  api = serve(dir, join(tmp, "data", "keel.sqlite"), apiPort);
  const apiUp = await ready(apiBase);
  step("serve api", apiUp, apiUp ? "" : api.log.slice(-3).join(" | "));
  let keys = 0;
  const write = (b = 0) => ({ key: `s${++keys}`, base: b, owner: "" });
  await post(apiBase, "/api/lists", { name: "Home", write: write() });
  const listId = String(field(view((await get(apiBase, "/api/lists")).body), "lists", "0", "id"));
  for (const title of ["Milk", "Eggs"])
    await post(apiBase, `/api/lists/${listId}/todos`, { title, priority: "normal", write: write() });
  web = serveWeb(dir, webPort, apiBase);
  let up = false;
  for (const end = Date.now() + 20_000; Date.now() < end && !up; await wait(100))
    up = await fetch(`${webBase}/lists/${listId}`).then(
      (r) => r.status === 200,
      () => false,
    );
  step("serve web", up, up ? "" : web.log.slice(-3).join(" | "));

  browser = await chromium.launch();
  for (let run = 1; run <= runs; run++) {
    const page = await browser.newPage();
    const logged = [];
    page.on("console", (m) => {
      if (m.type() === "warning" || m.type() === "error") logged.push(`${m.type()}: ${m.text()}`);
    });
    page.on("pageerror", (e) => logged.push(`pageerror: ${String(e).split("\n")[0]}`));
    await page.addInitScript(watch);
    const res = await page.goto(`${webBase}/lists/${listId}`, { waitUntil: "load" });
    const html = res === null ? "" : await res.text();
    step(`run ${run} served regions`, html.includes("<!--[-->") && html.includes('data-k-island="todos.list"'));
    await wait(1000);
    const kept = await page.evaluate(() => {
      const k = Reflect.get(window, "__keelSmoke");
      const rows = Object.entries(k.rows);
      return {
        served: k.served.length,
        gone: k.served.filter((el) => !el.isConnected).length,
        removed: k.removed,
        rows: rows.length,
        sameRows: rows.filter(([id, el]) => document.getElementById(id) === el).length,
        islands: [...document.querySelectorAll("[data-k-island]")].map((e) => e.getAttribute("data-k-island")),
      };
    });
    step(`run ${run} islands kept`, kept.islands.length === 2, kept.islands.join(" "));
    step(
      `run ${run} nothing removed`,
      kept.gone === 0 && kept.removed === 0,
      `${kept.removed} removed, ${kept.gone} of ${kept.served} served elements gone`,
    );
    step(
      `run ${run} rows kept`,
      kept.rows === 2 && kept.sameRows === 2,
      `${kept.sameRows} of ${kept.rows} rows are the served elements`,
    );
    const box = page.locator('input[type="checkbox"][id^="todos.toggle."]').first();
    const was = await box.isChecked();
    await box.click();
    await page
      .waitForFunction(
        (w) => document.querySelector('input[type="checkbox"][id^="todos.toggle."]')?.checked === !w,
        was,
        { timeout: 5000 },
      )
      .catch(() => undefined);
    const now = await box.isChecked();
    const board = view((await get(apiBase, "/api/lists")).body);
    const stored = field(board, "todos", "0", "done");
    step(`run ${run} toggle`, now === !was && stored === !was, `checked ${was} -> ${now}, stored ${stored}`);
    step(`run ${run} console`, logged.length === 0, logged.slice(0, 3).join(" | "));
    await page.close();
  }
} catch (e) {
  step("flow", false, String(e).split("\n")[0]);
} finally {
  await browser?.close();
  await stop(web);
  await stop(api);
  await rm(tmp, { recursive: true, force: true });
}
finish("resume");

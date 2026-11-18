// Resume proof for served golden-2 pages in a real browser: build a copy whose `web` deployable is a `node` server
// holding the `recipes` module, serve its `api` on a web storage file and the web server on free ports, seed two
// recipes through the api, then in headless Chromium load the index page (the `recipes.shell` layout around an `If`
// and a `For` of recipe rows) and the show page (the `recipes.show` island), and check that each served page stays in
// place: no console warning or error, no element removed after the parser finished, every served element still in the
// document, each recipe row the very element the server sent, every served island still marked; then a click on the
// show page's favorite toggle posts the action and shows the recipe as a favorite, and the api stores it.
// Usage: node tooling/smoke/resume.mjs [runs] (default 1). Nothing is written inside the repo.
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { buildIn, copyApp, field, freePort, get, post, recorder, root, stop, wait } from "./built.mjs";

const SECRET = "golden-2-smoke-secret-of-32-bytes-or-more";
const golden2 = join(root, "apps", "golden-2");

/** Start the built deployable `name` of `dir` at `port` with web storage in `file` and `peers` as its environment. */
function serveDeployable(dir, name, port, file, peers) {
  const child = spawn(
    process.execPath,
    [
      "--experimental-webstorage",
      `--localstorage-file=${file}`,
      "--disable-warning=ExperimentalWarning",
      join(dir, "dist", name, "server.mjs"),
    ],
    {
      cwd: dir,
      env: { ...process.env, PORT: String(port), KEEL_SECRET: SECRET, ...peers },
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

/** Poll `url` for a 200, at most `ms`. */
async function up(url, accept, ms = 20_000) {
  for (const end = Date.now() + ms; Date.now() < end; await wait(100)) {
    const ok = await fetch(url, { headers: { accept } }).then(
      (r) => r.status === 200,
      () => false,
    );
    if (ok) return true;
  }
  return false;
}

/** The recipes `GET /api/recipes` lists. */
async function recipes(base) {
  const list = field((await get(base, "/api/recipes")).body, "results", "kitchen.recipes", "value", "recipes");
  return Array.isArray(list) ? list : [];
}

/** Before any script runs: at the end of parsing, keep every served element and count every element removed after. */
function watch() {
  const k = { served: [], rows: {}, removed: 0 };
  Reflect.set(window, "__keelSmoke", k);
  document.addEventListener("readystatechange", () => {
    if (document.readyState !== "interactive" || k.served.length > 0) return;
    k.served = [...document.body.querySelectorAll("*")];
    for (const row of document.querySelectorAll('[id^="recipes.item."]')) k.rows[row.id] = row;
    new MutationObserver((records) => {
      for (const r of records) for (const n of r.removedNodes) if (n.nodeType === 1) k.removed++;
    }).observe(document, { childList: true, subtree: true });
  });
}

/** The island ids the served `html` marks, in document order. */
const islandsIn = (html) => [...html.matchAll(/data-k-island="([^"]*)"/g)].map((m) => m[1]);

/** What resume left of the served page. */
const kept = (page) =>
  page.evaluate(() => {
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

const runs = Number(process.argv[2] ?? "1");
const { step, finish } = recorder();
const tmp = await mkdtemp(join(tmpdir(), "keel-smoke-resume-"));
let api;
let web;
let browser;
try {
  const dir = join(tmp, "app");
  await copyApp(dir, golden2);
  // The pages are served, not mounted: `web` becomes a node deployable reaching `api` as its peer.
  const topo = join(dir, "topology.ts");
  const source = await readFile(topo, "utf8");
  const node = source.replace(/web: \{[^\n]*\},\n/, 'web: { modules: ["recipes"], adapter: "node" },\n');
  await writeFile(topo, node);
  step("topology", node !== source);
  step("build", await buildIn(dir));
  const apiPort = await freePort();
  const apiBase = `http://127.0.0.1:${apiPort}`;
  const webPort = await freePort();
  const webBase = `http://127.0.0.1:${webPort}`;
  // Each deployable names the other as its peer.
  const peers = { KEEL_PEER_API: apiBase, KEEL_PEER_WEB: webBase };
  api = serveDeployable(dir, "api", apiPort, join(tmp, "api.storage"), peers);
  const apiUp = await up(`${apiBase}/api/recipes`, "application/json");
  step("serve api", apiUp, apiUp ? "" : api.log.slice(-3).join(" | "));
  const seeds = [
    { title: "Pasta bake", minutes: 30, price: { amount: 1250, currency: "EUR" } },
    { title: "Miso soup", minutes: 90, price: { amount: 1800, currency: "JPY" } },
  ];
  const statuses = [];
  for (const body of seeds) statuses.push(await post(apiBase, "/api/recipes", body));
  const seeded = await recipes(apiBase);
  const soup = seeded.find((r) => r.title === "Miso soup")?.id;
  step("seed", statuses.every((s) => s === 200) && seeded.length === 2 && typeof soup === "string", statuses.join(" "));
  web = serveDeployable(dir, "web", webPort, join(tmp, "web.storage"), peers);
  const webUp = await up(`${webBase}/`, "text/html");
  step("serve web", webUp, webUp ? "" : web.log.slice(-3).join(" | "));

  browser = await chromium.launch();
  for (let run = 1; run <= runs; run++) {
    const page = await browser.newPage();
    const logged = [];
    page.on("console", (m) => {
      if (m.type() === "warning" || m.type() === "error") logged.push(`${m.type()}: ${m.text()}`);
    });
    page.on("pageerror", (e) => logged.push(`pageerror: ${String(e).split("\n")[0]}`));
    await page.addInitScript(watch);

    // The index: the shell layout around the recipe rows.
    const res = await page.goto(`${webBase}/`, { waitUntil: "load" });
    const html = res === null ? "" : await res.text();
    step(
      `run ${run} index served`,
      res?.status() === 200 && html.includes('id="recipes.shell"') && html.includes("<!--[-->"),
      `status ${res?.status() ?? 0}`,
    );
    await wait(1000);
    const index = await kept(page);
    const indexIslands = islandsIn(html).join(" ");
    step(`run ${run} index islands kept`, index.islands.join(" ") === indexIslands, `served [${indexIslands}]`);
    step(
      `run ${run} index nothing removed`,
      index.gone === 0 && index.removed === 0,
      `${index.removed} removed, ${index.gone} of ${index.served} served elements gone`,
    );
    step(
      `run ${run} index rows kept`,
      index.rows === 2 && index.sameRows === 2,
      `${index.sameRows} of ${index.rows} rows are the served elements`,
    );

    // The show page: its favorite toggle works after resume.
    const showRes = await page.goto(`${webBase}/recipes/${encodeURIComponent(soup)}`, { waitUntil: "load" });
    const showHtml = showRes === null ? "" : await showRes.text();
    step(
      `run ${run} show served`,
      showRes?.status() === 200 &&
        islandsIn(showHtml).includes("recipes.show") &&
        showHtml.includes('id="recipes.toggleFavorite"'),
      `status ${showRes?.status() ?? 0}`,
    );
    await wait(1000);
    const show = await kept(page);
    const showIslands = islandsIn(showHtml).join(" ");
    step(
      `run ${run} show islands kept`,
      show.islands.join(" ") === showIslands,
      `served [${showIslands}], marked [${show.islands.join(" ")}]`,
    );
    step(
      `run ${run} show nothing removed`,
      show.gone === 0 && show.removed === 0,
      `${show.removed} removed, ${show.gone} of ${show.served} served elements gone`,
    );
    const label = () => page.evaluate(() => document.getElementById("recipes.favorite")?.textContent ?? "");
    const wasStored = (await recipes(apiBase)).find((r) => r.id === soup)?.favorite === true;
    const before = await label();
    await page.locator('[id="recipes.toggleFavorite"]').click();
    await page
      .waitForFunction((b) => (document.getElementById("recipes.favorite")?.textContent ?? "") !== b, before, {
        timeout: 5000,
      })
      .catch(() => undefined);
    const after = await label();
    const stored = (await recipes(apiBase)).find((r) => r.id === soup)?.favorite === true;
    step(
      `run ${run} favorite`,
      after !== before && after !== "" && stored === !wasStored,
      `"${before}" -> "${after}", stored ${wasStored} -> ${stored}`,
    );
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

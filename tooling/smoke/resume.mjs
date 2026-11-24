// Resume proof for served golden-2 pages in a real browser: build a copy whose `web` deployable is a `node` server
// holding the `recipes` module, serve its `api` (golden-2's real `api` node deployable) on a web storage file and its
// app database in a PGlite folder (`KEEL_POSTGRES_URL=pglite:<folder>`) and the web server on free ports, seed two
// recipes through the api, stop the api and start it again on the same folder (both recipes are still there), then in
// headless Chromium load the recipe index, a
// recipe's show page, the new-recipe page and the catalog from `web` and the sign-in page from `api`. The page's
// scripts are held until the test has typed into an input and set its caret (new-recipe, sign-in) or scrolled the
// page (index, show, catalog; Chrome itself scrolls a page with a focused input back to the top after load); then
// on each page: no console warning or error; no element removed after the parser finished and no element added under
// an island root while it resumes (text may be replaced and empty anchors added); every served element and island
// mark still there; focus, typed value, caret and scroll position kept; and one interaction working. Last, on a fresh
// page, the sign-in form is filled and submitted with Enter while the scripts are still held: the browser sends
// exactly one POST. Then, scripts running, a sign-up and a sign-in through the forms: each one POST to the identity
// mount answered by a 303, and the sign-in page then names the account, with no console warning or error.
// Last, the built apps/household (`pnpm --filter household build`; it is not built here), whose `web` is a `node`
// deployable, served on a free port with its data in the temporary folder: a member's setup page, which holds a form
// and the weekly staples panel (a `live` island with a status line), is loaded the same way with the household name
// typed before resume. It resumes as the pages above do and says Live; a run a second client starts through the API
// shows on it with the typed name, the caret and focus as they were and no reload; the form saves the name typed
// before resume; the server is killed and the page says Connecting, then Live once it is back and the run done; the
// browser goes offline, a second client starts another run the page does not show, and back online the page says Live
// and shows it.
// The catalog is also loaded at 390px in en-US and de-DE: the document is no wider than the viewport and the table
// scrolls inside its region.
// Usage: node tooling/smoke/resume.mjs [runs] (default 1). Nothing is written inside the repo.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { buildIn, copyApp, field, freePort, get, keepOutput, recorder, root, stop, wait } from "./built.mjs";

const SECRET = "golden-2-smoke-secret-of-32-bytes-or-more";
/** The sign-in library's secret (`BETTER_AUTH_SECRET`), which golden-2's server requires. */
const AUTH_SECRET = "golden-2-smoke-auth-secret-of-32-characters";
const golden2 = join(root, "apps", "golden-2");
const household = join(root, "apps", "household");

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
      env: {
        ...process.env,
        PORT: String(port),
        KEEL_SECRET: SECRET,
        BETTER_AUTH_SECRET: AUTH_SECRET,
        KEEL_POSTGRES_URL: `pglite:${file}.postgres`,
        ...peers,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const log = [];
  for (const out of [child.stdout, child.stderr]) out.on("data", (d) => log.push(...String(d).trim().split("\n")));
  keepOutput(`serve ${name} :${port}`, log);
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

/** Sign up and sign in through the identity mount as the account forms post; the session cookie, or "" when none is set. */
async function session(base) {
  const email = `seed-${Date.now()}@example.com`;
  const password = "smoke password";
  const mount = (path, fields) =>
    fetch(`${base}/api/auth${path}`, {
      method: "POST",
      headers: { accept: "text/html", "content-type": "application/x-www-form-urlencoded", origin: base },
      body: new URLSearchParams(fields).toString(),
      redirect: "manual",
    }).then(
      (r) => r.headers.getSetCookie(),
      () => [],
    );
  await mount("/sign-up/email", { name: "Seed Cook", email, password });
  const cookies = await mount("/sign-in/email", { email, password });
  return cookies
    .map((c) => c.split(";")[0])
    .filter((c) => c.startsWith("better-auth.session_token="))
    .join("; ");
}

/** `POST path` on `base` as the signed-in `cookie`; the status, 0 when the server does not answer. */
const postAs = (base, path, body, cookie) =>
  fetch(`${base}${path}`, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json", "x-keel": "1", cookie },
    body: JSON.stringify(body),
  }).then(
    (r) => r.status,
    () => 0,
  );

/** The recipes `GET /api/recipes` lists. */
async function recipes(base) {
  const list = field((await get(base, "/api/recipes")).body, "results", "kitchen.box", "value", "recipes");
  return Array.isArray(list) ? list : [];
}

/**
 * Before any script runs: at the end of parsing, keep every served element, then count every element removed and
 * every element added under an island root. The household frame's list of recorded events is left out: it gains a
 * line for each event the recorder keeps, the input claimed at resume among them.
 */
function watch() {
  const k = { served: [], rows: {}, removed: 0, added: 0, observer: null };
  Reflect.set(window, "__keelSmoke", k);
  document.addEventListener("readystatechange", () => {
    if (document.readyState !== "interactive" || k.served.length > 0) return;
    k.served = [...document.body.querySelectorAll("*")];
    for (const row of document.querySelectorAll('[id^="recipes.item."]')) k.rows[row.id] = row;
    k.observer = new MutationObserver((records) => {
      for (const r of records) {
        for (const n of r.removedNodes) if (n.nodeType === 1) k.removed++;
        const t = r.target;
        const inIsland =
          t.nodeType === 1 &&
          t.closest("[data-k-island]") !== null &&
          t.closest("[id='app.recording.events']") === null;
        for (const n of r.addedNodes) if (n.nodeType === 1 && inIsland) k.added++;
      }
    });
    k.observer.observe(document, { childList: true, subtree: true });
  });
}

/** The island ids the served `html` marks, in document order. */
const islandsIn = (html) => [...html.matchAll(/data-k-island="([^"]*)"/g)].map((m) => m[1]);

/** What resume left of the served page; the observer stops here, so later interactions are not counted. */
const kept = (page) =>
  page.evaluate(() => {
    const k = Reflect.get(window, "__keelSmoke");
    for (const r of k.observer?.takeRecords() ?? []) {
      for (const n of r.removedNodes) if (n.nodeType === 1) k.removed++;
      const t = r.target;
      const inIsland =
        t.nodeType === 1 && t.closest("[data-k-island]") !== null && t.closest("[id='app.recording.events']") === null;
      for (const n of r.addedNodes) if (n.nodeType === 1 && inIsland) k.added++;
    }
    k.observer?.disconnect();
    // The note prints "<n> events kept" and lists at most the newest 12; a page without the note has no tally.
    const eventTally = () => {
      const list = document.getElementById("app.recording.events");
      const n = Number.parseInt(document.getElementById("app.recording.count")?.textContent ?? "", 10);
      return list === null || Number.isNaN(n) ? null : { listed: list.children.length, kept: n };
    };
    const rows = Object.entries(k.rows);
    const a = document.activeElement;
    return {
      served: k.served.length,
      gone: k.served.filter((el) => !el.isConnected).length,
      removed: k.removed,
      added: k.added,
      events: eventTally(),
      rows: rows.length,
      sameRows: rows.filter(([id, el]) => document.getElementById(id) === el).length,
      islands: [...document.querySelectorAll("[data-k-island]")].map((e) => e.getAttribute("data-k-island")),
      focus: {
        id: a?.id ?? "",
        same: a !== null && k.served.includes(a),
        value: a instanceof HTMLInputElement ? a.value : "",
        caret: a instanceof HTMLInputElement ? a.selectionStart : null,
      },
      scrollY: window.scrollY,
    };
  });

/** Before resume: focus the input `selector`, type `text` and put the caret after its second character. */
async function typeBefore(page, selector, text) {
  await page.focus(selector);
  await page.keyboard.type(text);
  await page.evaluate((sel) => document.querySelector(sel)?.setSelectionRange(2, 2), selector);
  return { text, caret: 2 };
}

/** Before resume: scroll the page down by up to 200 px; the position, or null when the page does not scroll. */
const scrollBefore = (page) =>
  page.evaluate(() => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (max <= 0) return null;
    window.scrollTo(0, Math.min(200, max));
    return window.scrollY;
  });

/**
 * Load `url` with every script held until `before(page)` has run on the parsed document, then let the page resume.
 * Returns the served HTML, the status, what `before` set up and what resume kept.
 */
async function visit(page, url, before) {
  const open = { release: () => undefined };
  const gate = new Promise((resolve) => {
    open.release = resolve;
  });
  const hold = async (route) => {
    await gate;
    await route.continue();
  };
  await page.route("**/*.js", hold);
  const res = await page.goto(url, { waitUntil: "commit" });
  await page.waitForFunction(() => document.readyState !== "loading");
  const html = res === null ? "" : await res.text();
  const set = await before(page);
  open.release();
  await page.waitForLoadState("load");
  await wait(1000);
  const state = await kept(page);
  await page.unroute("**/*.js", hold);
  return { html, status: res?.status() ?? 0, set, state };
}

/** The checks every page gets: served, islands marked, nothing removed or added, focus and scroll kept. */
function checkPage(step, label, v, served) {
  step(`${label} served`, v.status === 200 && served(v.html), `status ${v.status}`);
  const islands = islandsIn(v.html).join(" ");
  step(`${label} islands kept`, v.state.islands.join(" ") === islands, `served [${islands}]`);
  step(
    `${label} nothing removed or added`,
    v.state.gone === 0 && v.state.removed === 0 && v.state.added === 0,
    `${v.state.removed} removed, ${v.state.added} added under islands, ${v.state.gone} of ${v.state.served} served elements gone`,
  );
  const tally = v.state.events;
  if (tally !== null)
    step(
      `${label} recorded events not doubled`,
      tally.listed <= Math.min(12, tally.kept),
      `${tally.listed} listed, ${tally.kept} kept`,
    );
  if (v.set.typed !== undefined) {
    const f = v.state.focus;
    step(
      `${label} focus kept`,
      f.same && f.value === v.set.typed.text && f.caret === v.set.typed.caret,
      `focus ${f.id || "none"} (served ${f.same}), value "${f.value}", caret ${f.caret}`,
    );
  }
  if (typeof v.set.scrollY === "number")
    step(`${label} scroll kept`, v.state.scrollY === v.set.scrollY, `${v.set.scrollY} -> ${v.state.scrollY}`);
}

/** The text of the field error under the input `selector` (its `aria-describedby`). */
const fieldError = (page, selector) =>
  page.evaluate((sel) => {
    const input = document.querySelector(sel);
    const ids = (input?.getAttribute("aria-describedby") ?? "").split(" ").filter((x) => x !== "");
    return ids
      .map((id) => document.getElementById(id)?.textContent ?? "")
      .join(" ")
      .trim();
  }, selector);

/** `POST /api/restock` (Run now) on `base` as the member `cookie`, as a second client; the status. */
const runNow = (base, cookie) => postAs(base, "/api/restock", {}, cookie);

/** The latest weekly run `GET /api/restock` answers to the member `cookie`, or null. */
async function lastRun(base, cookie) {
  const r = await fetch(`${base}/api/restock`, { headers: { accept: "application/json", cookie } }).catch(() => null);
  if (r === null || r.status !== 200) return null;
  return field(await r.json().catch(() => null), "results", "shopping.runs", "value", "last") ?? null;
}

/** Poll the latest run until `done(run)` holds, at most `ms`; the run then, or null. */
async function runUntil(base, cookie, done, ms) {
  for (const end = Date.now() + ms; Date.now() < end; await wait(100)) {
    const run = await lastRun(base, cookie);
    if (run !== null && done(run)) return run;
  }
  return null;
}

/** The trimmed text of the element `id` on `page`, "" when it is absent. */
const textOf = (page, id) => page.evaluate((i) => (document.getElementById(i)?.textContent ?? "").trim(), id);

/** Poll the text of `id` on `page` until `holds(text)`, at most `ms`; whether it held. */
async function textUntil(page, id, holds, ms) {
  for (const end = Date.now() + ms; Date.now() < end; await wait(100)) {
    if (holds(await textOf(page, id).catch(() => ""))) return true;
  }
  return false;
}

/** The focused element against the served ones the page still holds: a reload leaves none. */
const focusNow = (page) =>
  page.evaluate(() => {
    const k = Reflect.get(window, "__keelSmoke");
    const a = document.activeElement;
    return {
      id: a?.id ?? "",
      same: a !== null && k.served.includes(a),
      value: a instanceof HTMLInputElement ? a.value : "",
      caret: a instanceof HTMLInputElement ? a.selectionStart : null,
      marked: Reflect.get(window, "smokeMark") === "kept",
    };
  });

/**
 * The household setup page as the member `h.cookie`: resume with the name typed, a live update from a second client,
 * the form's submit, a server restart and an offline window. `h.restart()` kills the server and starts it again.
 */
async function liveForm(browser, step, run, h) {
  const label = `run ${run} setup`;
  const context = await browser.newContext({ viewport: { width: 1000, height: 500 } });
  const [name, value] = h.cookie.split("=");
  await context.addCookies([{ name, value, url: h.base }]);
  const page = await context.newPage();
  const logged = [];
  page.on("console", (m) => {
    if (m.type() !== "warning" && m.type() !== "error") return;
    if (!m.text().startsWith("Failed to load resource")) logged.push(`${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => logged.push(`pageerror: ${String(e).split("\n")[0]}`));
  await page.addInitScript(watch);
  const live = "shopping.restock.live";
  const last = "shopping.restock.last";
  const started = "shopping.restock.started";
  const says = (word, ms) => textUntil(page, live, (t) => t.startsWith(word), ms);
  const input = 'input[name="name"]';
  const typed = `Elm Street ${run}`;

  // k.resume: the served document resumes keeping every server node; the server render has no stream (Connecting).
  const v = await visit(page, `${h.base}/setup`, async (p) => ({ typed: await typeBefore(p, input, typed) }));
  checkPage(
    step,
    label,
    v,
    (html) =>
      islandsIn(html).includes("setup.form") &&
      html.includes('id="setup.page"') &&
      /id="shopping\.restock\.live"[^>]*>Connecting/.test(html),
  );
  await page.evaluate(() => Object.assign(window, { smokeMark: "kept" }));
  // std.live: `status()` is `connecting` before the first read commits and `live` after it.
  step(
    `${label} says Live once its first read commits (std.live)`,
    await says("Live", 10_000),
    await textOf(page, live),
  );

  // std.live: a write by A is in B's hydrated store after B's next read, with no input from B.
  const before = `${await textOf(page, last)} ${await textOf(page, started)}`;
  const asked = await runNow(h.base, h.cookie);
  const shown = await textUntil(page, started, (t) => !before.endsWith(` ${t}`) && t !== "", 10_000);
  const now = await textOf(page, last);
  step(
    `${label} shows a run a second client starts, with no input (std.live)`,
    asked === 200 && shown && now.startsWith("Running"),
    `POST ${asked}, "${now}"`,
  );
  const f = await focusNow(page);
  step(
    `${label} typed name, caret and focus kept through the update, no reload (k.runtime)`,
    f.same && f.value === typed && f.caret === 2 && f.marked,
    `focus ${f.id || "none"} (served ${f.same}), value "${f.value}", caret ${f.caret}, marked ${f.marked}`,
  );
  step(`${label} says Live through the update (std.live)`, await says("Live", 5_000), await textOf(page, live));
  step(`${label} console`, logged.length === 0, logged.slice(0, 3).join(" | "));

  // k.forms: the field holds what was typed before resume; the submit sends it once and the action saves it.
  const posts = [];
  page.on("response", (r) => {
    if (r.request().method() === "POST") posts.push(`${r.status()} ${new URL(r.url()).pathname}`);
  });
  await page.click('[id="setup.save"]');
  const done = await page
    .locator('[id="setup.done"]')
    .waitFor({ timeout: 10_000 })
    .then(
      () => true,
      () => false,
    );
  let saved = null;
  for (const end = Date.now() + 5_000; Date.now() < end && saved !== typed; await wait(100)) {
    saved = field(
      await fetch(`${h.base}/api/household`, { headers: { accept: "application/json", cookie: h.cookie } }).then(
        (r) => r.json(),
        () => null,
      ),
      "results",
      "setup.household",
      "value",
      "name",
    );
  }
  step(
    `${label} form posts once and saves the name typed before resume (k.forms)`,
    done && saved === typed && posts.length === 1 && posts[0].endsWith(" /setup"),
    `${posts.join(" ")}, stored "${saved}"`,
  );
  step(`${label} says Live after the submit (std.live)`, await says("Live", 10_000), await textOf(page, live));
  await page.evaluate(() => Object.assign(window, { smokeMark: "kept" }));

  // std.live: `connecting` while the stream opens; after it reopens a read runs and the status is `live`.
  await h.kill();
  step(
    `${label} says Connecting once the server is gone (std.live)`,
    await says("Connecting", 15_000),
    await textOf(page, live),
  );
  const up = await h.start();
  step(
    `${label} says Live again after the restart (std.live)`,
    up && (await says("Live", 45_000)),
    await textOf(page, live),
  );
  const ended = await runUntil(h.base, h.cookie, (r) => r.state !== "running", 60_000);
  const caught = await textUntil(page, last, (t) => t.startsWith("Done: 5 of 5"), 10_000);
  step(
    `${label} shows the run done after the restart (std.live)`,
    ended?.state === "done" && caught,
    `run ${ended?.state}, "${await textOf(page, last)}"`,
  );

  // std.live: `offline` while the net is offline and no read runs; back online the stream reopens and one read runs.
  const stale = `${await textOf(page, last)} ${await textOf(page, started)}`;
  await context.setOffline(true);
  const off = await says("Offline", 10_000);
  const again = await runNow(h.base, h.cookie);
  const going = await runUntil(h.base, h.cookie, (r) => r.state === "running" && r.handled >= 1, 15_000);
  const held = `${await textOf(page, last)} ${await textOf(page, started)}`;
  step(
    `${label} says Offline and holds what it had while a second client starts a run (std.live)`,
    off && again === 200 && going !== null && held === stale,
    `${await textOf(page, live)}, POST ${again}, "${held}"`,
  );
  await context.setOffline(false);
  const on = await says("Live", 45_000);
  const fresh = await textUntil(page, started, (t) => t !== "" && !stale.endsWith(` ${t}`), 10_000);
  const marked = await page.evaluate(() => Reflect.get(window, "smokeMark") === "kept");
  step(
    `${label} says Live and shows that run once back online, no reload (std.live)`,
    on && fresh && marked,
    `${await textOf(page, live)}, "${await textOf(page, last)}", marked ${marked}`,
  );
  step(`${label} console through the restart`, logged.length === 0, logged.slice(0, 3).join(" | "));
  // The next run of this page starts a run of its own: this one ends first.
  await runUntil(h.base, h.cookie, (r) => r.state !== "running", 60_000);
  await context.close();
}

const runs = Number(process.argv[2] ?? "1");
const { step, finish, caught } = recorder();
const tmp = await mkdtemp(join(tmpdir(), "keel-smoke-resume-"));
let api;
let web;
let home;
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
  const cookie = await session(apiBase);
  step("seed session", cookie !== "");
  const statuses = [];
  for (const body of seeds) statuses.push(await postAs(apiBase, "/api/recipes", body, cookie));
  const seeded = await recipes(apiBase);
  const soup = seeded.find((r) => r.title === "Miso soup")?.id;
  step("seed", statuses.every((s) => s === 200) && seeded.length === 2 && typeof soup === "string", statuses.join(" "));
  // The recipes are in the PGlite folder, not the process: a new api process on the same folder reads them.
  await api.kill();
  api = serveDeployable(dir, "api", apiPort, join(tmp, "api.storage"), peers);
  const againUp = await up(`${apiBase}/api/recipes`, "application/json");
  const kept = againUp ? await recipes(apiBase) : [];
  step(
    "recipes survive an api restart",
    kept.length === 2 && kept.some((r) => r.id === soup),
    againUp ? `${kept.length} recipes` : api.log.slice(-3).join(" | "),
  );
  web = serveDeployable(dir, "web", webPort, join(tmp, "web.storage"), peers);
  const webUp = await up(`${webBase}/`, "text/html");
  step("serve web", webUp, webUp ? "" : web.log.slice(-3).join(" | "));

  // The household app as it is built: its `web` is a node deployable, so nothing is copied or changed.
  const homeBuilt = existsSync(join(household, "dist", "web", "server.mjs"));
  step("household built", homeBuilt, homeBuilt ? "" : "run pnpm --filter household build first");
  const homePort = await freePort();
  const h = {
    base: `http://127.0.0.1:${homePort}`,
    cookie: "",
    async start() {
      home = serveDeployable(household, "web", homePort, join(tmp, "household.storage"), {});
      return up(`${h.base}/`, "text/html");
    },
    async kill() {
      await home?.kill();
    },
  };
  const homeUp = homeBuilt && (await h.start());
  step("serve household", homeUp, homeUp ? "" : (home?.log.slice(-3).join(" | ") ?? ""));
  if (homeUp) h.cookie = await session(h.base);
  step("household session", h.cookie !== "" && !h.cookie.includes(";"));

  browser = await chromium.launch();
  for (let run = 1; run <= runs; run++) {
    const page = await browser.newPage({ viewport: { width: 1000, height: 500 } });
    const logged = [];
    page.on("console", (m) => {
      if (m.type() === "warning" || m.type() === "error") logged.push(`${m.type()}: ${m.text()}`);
    });
    page.on("pageerror", (e) => logged.push(`pageerror: ${String(e).split("\n")[0]}`));
    await page.addInitScript(watch);
    const scroll = async (p) => ({ scrollY: await scrollBefore(p) });

    // The index: the shell layout around the recipe rows; a row's link opens the recipe.
    const index = await visit(page, `${webBase}/`, scroll);
    checkPage(step, `run ${run} index`, index, (h) => h.includes('id="recipes.shell"') && h.includes("<!--[-->"));
    step(
      `run ${run} index rows kept`,
      index.state.rows === 2 && index.state.sameRows === 2,
      `${index.state.sameRows} of ${index.state.rows} rows are the served elements`,
    );
    const href = await page.locator('[id^="recipes.link."]').first().getAttribute("href");
    await page.locator('[id^="recipes.link."]').first().click();
    await page.waitForURL((u) => u.pathname === href, { timeout: 5000 }).catch(() => undefined);
    step(`run ${run} index link`, href !== null && new URL(page.url()).pathname === href, `${href} -> ${page.url()}`);

    // The show page: its favorite toggle works after resume.
    const show = await visit(page, `${webBase}/recipes/${encodeURIComponent(soup)}`, scroll);
    checkPage(
      step,
      `run ${run} show`,
      show,
      (h) => islandsIn(h).includes("recipes.show") && h.includes('id="recipes.toggleFavorite"'),
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
      `run ${run} show favorite`,
      after !== before && after !== "" && stored === !wasStored,
      `"${before}" -> "${after}", stored ${wasStored} -> ${stored}`,
    );

    // The new-recipe page: text typed into the title before resume stays, focused, with its caret; clearing the
    // title and leaving it shows the field's error.
    const title = 'input[name="title"]';
    const fresh = await visit(page, `${webBase}/recipes/new`, async (p) => ({
      typed: await typeBefore(p, title, "Soup"),
    }));
    checkPage(step, `run ${run} new`, fresh, (h) => h.includes('id="recipes.new"') && h.includes('name="title"'));
    await page.fill(title, "");
    await page.locator(title).blur();
    await page
      .waitForFunction(
        (s) => {
          const ids = (document.querySelector(s)?.getAttribute("aria-describedby") ?? "").split(" ");
          return ids.some((id) => (document.getElementById(id)?.textContent ?? "").trim() !== "");
        },
        title,
        { timeout: 5000 },
      )
      .catch(() => undefined);
    const titleError = await fieldError(page, title);
    step(`run ${run} new field error`, titleError !== "", `"${titleError}"`);

    // The catalog: the filters disclosure opens after resume.
    const catalog = await visit(page, `${webBase}/catalog`, scroll);
    checkPage(step, `run ${run} catalog`, catalog, (h) => h.includes('id="recipes.catalog"'));
    const toggle = '[id="recipes.catalogFilters.button"]';
    const was = await page.locator(toggle).getAttribute("aria-expanded");
    await page.locator(toggle).click();
    await page
      .waitForFunction(
        (w) => document.getElementById("recipes.catalogFilters.button")?.getAttribute("aria-expanded") !== w,
        was,
        {
          timeout: 5000,
        },
      )
      .catch(() => undefined);
    const now = await page.locator(toggle).getAttribute("aria-expanded");
    step(`run ${run} catalog disclosure`, was !== now && now === "true", `${was} -> ${now}`);

    // The catalog at 390px, in both served locales: the document is no wider than the viewport and the table scrolls
    // inside its region (RFC 0203).
    for (const locale of ["en-US", "de-DE"]) {
      const narrow = await browser.newPage({ viewport: { width: 390, height: 800 } });
      await narrow.goto(`${webBase}/${locale}/catalog`);
      await narrow.locator('[id="recipes.table.scroll"]').waitFor({ timeout: 15_000 });
      const sizes = await narrow.evaluate(() => {
        const region = document.getElementById("recipes.table.scroll");
        return {
          document: document.documentElement.scrollWidth,
          region: region?.clientWidth ?? 0,
          table: region?.scrollWidth ?? 0,
        };
      });
      step(
        `run ${run} catalog ${locale} at 390px does not scroll sideways`,
        sizes.document <= 390 && sizes.table > sizes.region,
        `document ${sizes.document}, region ${sizes.region}, table ${sizes.table}`,
      );
      await narrow.close();
    }

    // The sign-in page, served by `api`: the email typed before resume stays; a bad address shows the field's error.
    const email = 'input[name="email"]';
    const signin = await visit(page, `${apiBase}/account/signin`, async (p) => ({
      typed: await typeBefore(p, email, "cook@example.com"),
    }));
    checkPage(step, `run ${run} signin`, signin, (h) => h.includes('id="accounts.signin"'));
    await page.fill(email, "x");
    await page.locator(email).blur();
    await page
      .waitForFunction(
        (s) => {
          const ids = (document.querySelector(s)?.getAttribute("aria-describedby") ?? "").split(" ");
          return ids.some((id) => (document.getElementById(id)?.textContent ?? "").trim() !== "");
        },
        email,
        { timeout: 5000 },
      )
      .catch(() => undefined);
    const emailError = await fieldError(page, email);
    step(`run ${run} signin field error`, emailError !== "", `"${emailError}"`);

    step(`run ${run} console`, logged.length === 0, logged.slice(0, 3).join(" | "));
    await page.close();

    // A submit before the island resumes goes to the server once.
    const early = await browser.newPage();
    const posts = [];
    early.on("request", (r) => {
      if (r.method() === "POST") posts.push(new URL(r.url()).pathname);
    });
    const open = { release: () => undefined };
    const gate = new Promise((resolve) => {
      open.release = resolve;
    });
    await early.route("**/*.js", async (route) => {
      await gate;
      await route.continue().catch(() => undefined);
    });
    await early.goto(`${apiBase}/account/signin`, { waitUntil: "commit" });
    await early.waitForFunction(() => document.readyState !== "loading");
    await early.fill(email, "cook@example.com");
    await early.fill('input[name="password"]', "not-the-password");
    await early.press('input[name="password"]', "Enter");
    await wait(500);
    open.release();
    await early.waitForLoadState("load").catch(() => undefined);
    await wait(1000);
    step(`run ${run} early submit posts once`, posts.length === 1, `${posts.length} POST ${posts.join(" ")}`);
    await early.close();

    // Sign up, then sign in, through the forms: the browser posts each form once to the mount and follows its 303.
    const account = await browser.newPage();
    const said = [];
    account.on("console", (m) => {
      if (m.type() === "warning" || m.type() === "error") said.push(`${m.type()}: ${m.text()}`);
    });
    account.on("pageerror", (e) => said.push(`pageerror: ${String(e).split("\n")[0]}`));
    const sent = [];
    account.on("response", (r) => {
      if (r.request().method() === "POST") sent.push(`${r.status()} ${new URL(r.url()).pathname}`);
    });
    const who = `cook${run}@example.com`;
    await account.goto(`${apiBase}/account/signup`, { waitUntil: "load" });
    await account.fill('input[name="name"]', "Smoke Cook");
    await account.fill(email, who);
    await account.fill('input[name="password"]', "smoke password");
    await Promise.all([
      account.waitForURL((u) => u.pathname === "/account/signin", { timeout: 10_000 }).catch(() => undefined),
      account.click('[id="accounts.signupSubmit"]'),
    ]);
    step(
      `run ${run} sign-up posts once and redirects`,
      sent.join(" ") === "303 /api/auth/sign-up/email" && new URL(account.url()).pathname === "/account/signin",
      `${sent.join(" ")} -> ${account.url()}`,
    );
    await account.waitForLoadState("load");
    await account.fill(email, who);
    await account.fill('input[name="password"]', "smoke password");
    await Promise.all([
      account
        .waitForResponse((r) => r.request().method() === "GET" && new URL(r.url()).pathname === "/account/signin", {
          timeout: 10_000,
        })
        .catch(() => undefined),
      account.click('[id="accounts.signinSubmit"]'),
    ]);
    await account.waitForLoadState("load");
    const named = await account
      .locator('[id="accounts.signedIn"]')
      .textContent({ timeout: 5000 })
      .catch(() => "");
    step(
      `run ${run} sign-in posts once and names the account`,
      sent.length === 2 && sent[1] === "303 /api/auth/sign-in/email" && (named ?? "").includes(who),
      `${sent.join(" ")}, "${named}"`,
    );
    step(`run ${run} sign-in console`, said.length === 0, said.slice(0, 3).join(" | "));
    await account.close();

    if (h.cookie !== "") await liveForm(browser, step, run, h);
  }
} catch (e) {
  caught(e);
  step("flow", false, String(e).split("\n")[0]);
} finally {
  await browser?.close();
  await stop(web);
  await stop(api);
  await stop(home);
  await rm(tmp, { recursive: true, force: true });
}
finish("resume");

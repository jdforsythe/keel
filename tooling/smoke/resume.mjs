// Resume proof for served golden-2 pages in a real browser: build a copy whose `web` deployable is a `node` server
// holding the `recipes` module, serve its `api` (golden-2's real `api` node deployable) on a web storage file and the
// web server on free ports, seed two recipes through the api, then in headless Chromium load the recipe index, a
// recipe's show page, the new-recipe page and the catalog from `web` and the sign-in page from `api`. The page's
// scripts are held until the test has typed into an input and set its caret (new-recipe, sign-in) or scrolled the
// page (index, show, catalog; Chrome itself scrolls a page with a focused input back to the top after load); then
// on each page: no console warning or error; no element removed after the parser finished and no element added under
// an island root while it resumes (text may be replaced and empty anchors added); every served element and island
// mark still there; focus, typed value, caret and scroll position kept; and one interaction working. Last, on a fresh
// page, the sign-in form is filled and submitted with Enter while the scripts are still held: the browser sends
// exactly one POST. Then, scripts running, a sign-up and a sign-in through the forms: each one POST to the identity
// mount answered by a 303, and the sign-in page then names the account, with no console warning or error.
// Usage: node tooling/smoke/resume.mjs [runs] (default 1). Nothing is written inside the repo.
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { buildIn, copyApp, field, freePort, get, post, recorder, root, stop, wait } from "./built.mjs";

const SECRET = "golden-2-smoke-secret-of-32-bytes-or-more";
/** The sign-in library's secret (`BETTER_AUTH_SECRET`), which golden-2's server requires. */
const AUTH_SECRET = "golden-2-smoke-auth-secret-of-32-characters";
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
      env: { ...process.env, PORT: String(port), KEEL_SECRET: SECRET, BETTER_AUTH_SECRET: AUTH_SECRET, ...peers },
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

/**
 * Before any script runs: at the end of parsing, keep every served element, then count every element removed and
 * every element added under an island root.
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
        const inIsland = t.nodeType === 1 && t.closest("[data-k-island]") !== null;
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
      const inIsland = t.nodeType === 1 && t.closest("[data-k-island]") !== null;
      for (const n of r.addedNodes) if (n.nodeType === 1 && inIsland) k.added++;
    }
    k.observer?.disconnect();
    const rows = Object.entries(k.rows);
    const a = document.activeElement;
    return {
      served: k.served.length,
      gone: k.served.filter((el) => !el.isConnected).length,
      removed: k.removed,
      added: k.added,
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

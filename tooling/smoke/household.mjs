// Built-run proof for the walkthrough app apps/household: its built `web` deployable (`pnpm --filter household build`)
// served on a free port with web storage in a temporary folder, then driven in headless Chromium and over HTTP:
// the start page renders and the guard sends the list to setup; the document links the entry stylesheet, the file is
// served as CSS and a styled element has a non-default computed style; the setup action writes the household name;
// the shopping menu adds through the API and the list survives a reload; an API write and the loader agree; a
// cross-site write answers 403; a receipt form answered with a server error shows the typed values, `aria-invalid`
// and the error text, with scripts running and with scripts off; no page error or console error. The app data lives
// in PGlite in the same temporary folder: the server is killed with SIGKILL with a write in flight and restarted, and
// the list, the receipts and the household name are all there. When docker answers, the same kill and restart runs
// against a throwaway `postgres:17` container through `KEEL_POSTGRES_URL`; the container is removed after.
// Usage: node --disable-warning=ExperimentalWarning tooling/smoke/household.mjs. The app is not built here and nothing
// is written inside the repo; the server child and the container are removed on every path, and a crash prints the
// steps it had. No database URL is printed.
import { execFile, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { freePort, recorder, root, wait } from "./built.mjs";

const LIMIT_MS = 120_000;
const SECRET = "household-smoke-secret-of-32-bytes-or-more";
const app = join(root, "apps", "household");
const { step, finish } = recorder();
let server;
let browser;
let tmp;
let container;

/** Run `docker` with `args`; resolves its trimmed stdout, or null when it fails. */
const docker = (args) =>
  new Promise((resolve) =>
    execFile("docker", args, { timeout: 60_000 }, (e, out) => resolve(e === null ? String(out).trim() : null)),
  );

/** SIGKILL the server child; true once signalled or when there was none. */
const killServer = () => {
  if (server !== undefined && server.child.exitCode === null && server.child.signalCode === null) {
    server.child.kill("SIGKILL");
  }
};
process.on("exit", () => {
  killServer();
  if (container !== undefined) execFile("docker", ["rm", "-f", container], () => undefined);
});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    killServer();
    process.exit(130);
  });
}
const limit = setTimeout(() => {
  killServer();
  step("time limit", false, `${LIMIT_MS / 1000}s`);
  finish("household");
  process.exit(1);
}, LIMIT_MS);

/**
 * Start the built `web` deployable of the app on `port` with web storage in `file` and app data at `data`
 * (`KEEL_POSTGRES_URL`); its output is kept in `log`.
 */
function serve(port, file, data) {
  const child = spawn(
    process.execPath,
    [
      "--experimental-webstorage",
      `--localstorage-file=${file}`,
      "--disable-warning=ExperimentalWarning",
      join(app, "dist", "web", "server.mjs"),
    ],
    {
      cwd: app,
      env: { ...process.env, PORT: String(port), KEEL_SECRET: SECRET, KEEL_POSTGRES_URL: data },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const log = [];
  for (const out of [child.stdout, child.stderr]) out.on("data", (d) => log.push(...String(d).trim().split("\n")));
  child.once("error", (e) => log.push(String(e)));
  return { child, log };
}

/** SIGKILL the server and resolve once it has exited. */
async function killed() {
  const child = server.child;
  if (child.exitCode !== null || child.signalCode !== null) return;
  const gone = new Promise((r) => child.once("exit", r));
  child.kill("SIGKILL");
  await gone;
}

/** Poll `url` for a 200 page, at most `ms`; false when the server exits first. */
async function up(url, ms = 20_000) {
  for (const end = Date.now() + ms; Date.now() < end; await wait(100)) {
    if (server.child.exitCode !== null) return false;
    const ok = await fetch(url, { headers: { accept: "text/html" } }).then(
      (r) => r.status === 200,
      () => false,
    );
    if (ok) return true;
  }
  return false;
}

const byId = (page, id) => page.locator(`[id='${id}']`);
const settled = (page) => page.waitForLoadState("networkidle");
const clip = (v) => String(v).slice(0, 200);

const asJson = { accept: "application/json", "content-type": "application/json", "x-keel": "1" };
const sameSite = { "sec-fetch-site": "same-origin", "content-type": "application/x-www-form-urlencoded" };

/** The list as `GET /api/items` answers it, or null. */
async function itemsAt(origin) {
  const r = await fetch(`${origin}/api/items`, { headers: { accept: "application/json" } }).catch(() => null);
  if (r === null || r.status !== 200) return null;
  return (await r.json()).results["shopping.items"].value.items;
}

/** The list's three rules: at most 50 items, unique ids, one open item per name. */
function holds(items) {
  const open = items.filter((i) => !i.bought).map((i) => i.name);
  return (
    items.length <= 50 && new Set(items.map((i) => i.id)).size === items.length && new Set(open).size === open.length
  );
}

/** A native form post to `path` as a same-origin page sends it; resolves the status. */
const formPost = (origin, path, fields) =>
  fetch(`${origin}${path}`, {
    method: "POST",
    headers: sameSite,
    body: new URLSearchParams(fields).toString(),
    redirect: "manual",
  }).then(
    (r) => r.status,
    () => 0,
  );

/** The household name `GET /api/household` answers, or null. */
async function householdAt(origin) {
  const r = await fetch(`${origin}/api/household`, { headers: { accept: "application/json" } }).catch(() => null);
  return r === null ? null : (await r.json()).results["setup.household"].value.name;
}

/** The totals the receipts page lists, from its served HTML. */
async function totalsAt(origin) {
  const html = await fetch(`${origin}/receipts`, { headers: { accept: "text/html" } }).then(
    (r) => r.text(),
    () => "",
  );
  return [...html.matchAll(/id="receipts\.total\.[^"]+"[^>]*>([^<]+)</g)].map((m) => m[1]);
}

/** Start the server again on `port` after a SIGKILL, over the same storage and data; true once it answers. */
async function restart(port, file, data) {
  await killed();
  server = serve(port, file, data);
  return up(`http://127.0.0.1:${port}/`);
}

/** A throwaway `postgres:17` container; resolves its `postgres:` URL once it takes connections, or null. */
async function postgres17() {
  const id = await docker([
    "run",
    "-d",
    "--rm",
    "-e",
    "POSTGRES_PASSWORD=smoke",
    "-p",
    "127.0.0.1::5432",
    "postgres:17",
  ]);
  if (id === null) return null;
  container = id;
  const mapped = await docker(["port", id, "5432/tcp"]);
  const port = mapped?.split("\n")[0]?.split(":").at(-1);
  if (port === undefined) return null;
  // The image's init runs a server on the socket only; a TCP answer inside the container is the final server.
  for (const end = Date.now() + 60_000; Date.now() < end; await wait(250)) {
    if ((await docker(["exec", id, "pg_isready", "-q", "-h", "127.0.0.1", "-U", "postgres"])) !== null)
      return `postgres://postgres:smoke@127.0.0.1:${port}/postgres`;
  }
  return null;
}

/** Fill the setup form on `page` and wait for its done mark. */
async function setUp(page, origin, name) {
  await page.goto(`${origin}/setup`);
  await byId(page, "setup.form:name").fill(name);
  await byId(page, "setup.save").click();
  await byId(page, "setup.done").waitFor({ timeout: 10_000 });
}

/** Submit a receipt the server rejects and report what the page then shows. */
async function rejected(page) {
  await byId(page, "receipts.new:shop").fill("Market");
  await byId(page, "receipts.new:amount").fill("3.555");
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname === "/receipts"),
    byId(page, "receipts.save").click(),
  ]);
  await settled(page);
  return {
    shop: await byId(page, "receipts.new:shop").inputValue(),
    amount: await byId(page, "receipts.new:amount").inputValue(),
    invalid: await byId(page, "receipts.new:amount").getAttribute("aria-invalid"),
    error: ((await byId(page, "receipts.new:amount:error").textContent()) ?? "").trim(),
  };
}

try {
  tmp = await mkdtemp(join(tmpdir(), "keel-smoke-household-"));
  const built = existsSync(join(app, "dist", "web", "server.mjs"));
  step("built app", built, built ? "" : "run pnpm --filter household build first");
  if (!built) throw new Error("apps/household/dist/web/server.mjs is missing");
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const storage = join(tmp, "storage");
  const pglite = `pglite:${join(tmp, "postgres")}`;
  server = serve(port, storage, pglite);
  const ready = await up(`${origin}/`);
  step("serve web", ready, ready ? "" : server.log.slice(-3).join(" | "));
  if (!ready) throw new Error("the server did not answer");

  browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).split("\n")[0]));
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().startsWith("Failed to load resource")) errors.push(m.text());
  });

  await page.goto(`${origin}/`);
  const title = await page.title();
  step("start title", title === "Household", title);
  const sheets = await page.evaluate(() =>
    [...document.querySelectorAll("link[rel='stylesheet']")].map((l) => l.getAttribute("href") ?? ""),
  );
  step("document links a stylesheet", sheets.length > 0 && sheets.every((h) => h.endsWith(".css")), sheets.join(" "));
  const sheet = sheets[0] === undefined ? undefined : await fetch(new URL(sheets[0], origin));
  const type = sheet?.headers.get("content-type") ?? "";
  step("stylesheet is served as css", sheet?.status === 200 && type.startsWith("text/css"), `${sheet?.status} ${type}`);

  await byId(page, "app.start.toList").click();
  await settled(page);
  step("guard sends the list to setup", page.url() === `${origin}/setup?next=%2Flist`, page.url());
  await byId(page, "setup.form:name").fill("Elm Street");
  await byId(page, "setup.save").click();
  await byId(page, "setup.done").waitFor({ timeout: 10_000 });
  const household = await page.request.get(`${origin}/api/household`, { headers: { accept: "application/json" } });
  const named = clip(await household.text());
  step("setup action writes the name", household.status() === 200 && named.includes("Elm Street"), named);

  await page.goto(`${origin}/receipts`);
  await settled(page);
  const padding = await byId(page, "receipts.page").evaluate((e) => getComputedStyle(e).padding);
  step("a styled element has a non-default computed style", padding !== "0px" && padding !== "", `padding ${padding}`);

  await page.goto(`${origin}/list`);
  await settled(page);
  const list = await page.title();
  step("list title", list === "Shopping list", list);
  const row = page.locator("[id^='shopping.name.']").first();
  for (let i = 0; i < 2; i++) {
    await byId(page, "shopping.staples.trigger").click();
    await byId(page, "shopping.staples.item.milk").click();
    if (i === 0) await row.waitFor({ timeout: 10_000 });
  }
  await row.filter({ hasText: "× 2" }).waitFor({ timeout: 10_000 });
  step(
    "menu adds through the API and raises quantity",
    (await row.textContent()) === "Milk × 2",
    clip(await row.textContent()),
  );
  await page.reload();
  await settled(page);
  const kept = await page.locator("[id^='shopping.name.']").first().textContent();
  step("the list survives a reload", kept === "Milk × 2", clip(kept));
  await byId(page, "shopping.help.button").click();
  step("disclosure opens", (await byId(page, "shopping.help.button").getAttribute("aria-expanded")) === "true");

  const write = await page.request.post(`${origin}/api/items`, { headers: asJson, data: { name: "Eggs" } });
  const read = await page.request.get(`${origin}/api/items`, { headers: { accept: "application/json" } });
  const apiItems = await read.text();
  step(
    "API write is in the API read",
    write.status() === 200 && apiItems.includes("Eggs"),
    `${write.status()} ${clip(apiItems)}`,
  );
  await page.goto(`${origin}/list`);
  await settled(page);
  const shown = (await page.locator("[id^='shopping.name.']").allTextContents()).join(",");
  step("the loader shows what the API wrote", shown.includes("Eggs") && shown.includes("Milk"), shown);

  const crossSite = { origin: "https://evil.example", "sec-fetch-site": "cross-site" };
  const crossForm = await fetch(`${origin}/setup`, {
    method: "POST",
    headers: { ...crossSite, "content-type": "application/x-www-form-urlencoded", accept: "text/html" },
    body: "name=Intruder",
    redirect: "manual",
  }).then(
    (r) => r.status,
    () => 0,
  );
  const crossApi = await fetch(`${origin}/api/items`, {
    method: "POST",
    headers: { ...crossSite, "content-type": "application/json", accept: "*/*" },
    body: JSON.stringify({ name: "Intruder" }),
  }).then(
    (r) => r.status,
    () => 0,
  );
  const items = await (
    await page.request.get(`${origin}/api/items`, { headers: { accept: "application/json" } })
  ).text();
  const who = await (
    await page.request.get(`${origin}/api/household`, { headers: { accept: "application/json" } })
  ).text();
  step(
    "cross-site writes get 403 and write nothing",
    crossForm === 403 && crossApi === 403 && !items.includes("Intruder") && !who.includes("Intruder"),
    `form ${crossForm}, api ${crossApi}`,
  );

  await page.goto(`${origin}/receipts`);
  await settled(page);
  await byId(page, "receipts.new:shop").fill("Market");
  await byId(page, "receipts.new:amount").fill("3.5");
  await byId(page, "receipts.save").click();
  await page.locator("[id^='receipts.total.']").first().waitFor({ timeout: 10_000 });
  const totals = await page.locator("[id^='receipts.total.']").allTextContents();
  step("form records a receipt", totals.includes("€3.50"), totals.join(","));

  const on = await rejected(page);
  step(
    "rejected form keeps the typed values and shows the error, scripts on",
    on.shop === "Market" && on.amount === "3.555" && on.invalid === "true" && on.error !== "",
    JSON.stringify(on),
  );
  step("no page errors", errors.length === 0, clip(errors.join(" | ")));

  const plain = await browser.newContext({ javaScriptEnabled: false });
  const bare = await plain.newPage();
  await setUp(bare, origin, "Oak Road");
  await bare.goto(`${origin}/receipts`);
  const off = await rejected(bare);
  step(
    "rejected form keeps the typed values and shows the error, scripts off",
    off.shop === "Market" && off.amount === "3.555" && off.invalid === "true" && off.error !== "",
    JSON.stringify(off),
  );
  await plain.close();

  const rice = await fetch(`${origin}/api/items`, { method: "POST", headers: asJson, body: '{"name":"Rice"}' });
  const inFlight = fetch(`${origin}/api/items`, { method: "POST", headers: asJson, body: '{"name":"Flour"}' }).catch(
    () => null,
  );
  const back = await restart(port, storage, pglite);
  await inFlight;
  step("restart after SIGKILL with a write in flight", rice.status === 200 && back, server.log.slice(-2).join(" | "));
  const after = (await itemsAt(origin)) ?? [];
  const names = after.map((i) => i.name);
  step(
    "PGlite keeps the list through the kill, rules intact",
    ["Milk", "Eggs", "Rice"].every((n) => names.includes(n)) && holds(after),
    clip(names.join(",")),
  );
  const keptTotals = await totalsAt(origin);
  const keptName = await householdAt(origin);
  step(
    "PGlite keeps the receipts and the store keeps the name",
    keptTotals.includes("€3.50") && keptName === "Oak Road",
    `${keptTotals.join(",")} ${keptName}`,
  );

  if ((await docker(["info", "--format", "{{.ServerVersion}}"])) === null) {
    step("postgres 17 skipped: docker is not running", true);
  } else {
    const url = await postgres17();
    step("postgres 17 container takes connections", url !== null);
    if (url !== null) {
      await killed();
      const pgPort = await freePort();
      const pgOrigin = `http://127.0.0.1:${pgPort}`;
      const pgStorage = join(tmp, "storage-17");
      server = serve(pgPort, pgStorage, url);
      const served17 = await up(`${pgOrigin}/`);
      const named = await formPost(pgOrigin, "/setup", { name: "Birch Lane" });
      const added = await fetch(`${pgOrigin}/api/items`, { method: "POST", headers: asJson, body: '{"name":"Tea"}' });
      const paid = await formPost(pgOrigin, "/receipts", {
        shop: "Bakery",
        amount: "4.20",
        currency: "EUR",
        paidBy: "sam",
      });
      step(
        "postgres 17 serves the app and takes writes",
        served17 && named === 303 && added.status === 200 && paid === 303,
        `setup ${named}, item ${added.status}, receipt ${paid}`,
      );
      const again = await restart(pgPort, pgStorage, url);
      const tea = ((await itemsAt(pgOrigin)) ?? []).map((i) => i.name);
      const pgTotals = await totalsAt(pgOrigin);
      step(
        "postgres 17 keeps the list and the receipts through a SIGKILL and restart",
        again && tea.includes("Tea") && pgTotals.includes("€4.20"),
        `${tea.join(",")} ${pgTotals.join(",")}`,
      );
    }
  }
} catch (e) {
  step("flow", false, clip(String(e).split("\n")[0]));
} finally {
  clearTimeout(limit);
  await browser?.close().catch(() => undefined);
  killServer();
  if (container !== undefined) await docker(["rm", "-f", container]);
  container = undefined;
  if (tmp !== undefined) await rm(tmp, { recursive: true, force: true });
}
finish("household");

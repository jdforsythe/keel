// Built-run proof for the walkthrough app apps/household: its built `web` deployable (`pnpm --filter household build`)
// served on a free port with web storage in a temporary folder, then driven in headless Chromium and over HTTP:
// the start page renders and the guard sends the list to setup; the document links the entry stylesheet, the file is
// served as CSS and a styled element has a non-default computed style; the setup action writes the household name;
// the shopping menu adds through the API and the list survives a reload; an API write and the loader agree; a
// cross-site write answers 403; a receipt form answered with a server error shows the typed values, `aria-invalid`
// and the error text, with scripts running and with scripts off; no page error or console error.
// Usage: node --disable-warning=ExperimentalWarning tooling/smoke/household.mjs. The app is not built here and nothing
// is written inside the repo; the server child is killed on every path, and a crash prints the steps it had.
import { spawn } from "node:child_process";
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

/** SIGKILL the server child; true once signalled or when there was none. */
const killServer = () => {
  if (server !== undefined && server.child.exitCode === null && server.child.signalCode === null) {
    server.child.kill("SIGKILL");
  }
};
process.on("exit", killServer);
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

/** Start the built `web` deployable of the app on `port` with web storage in `file`; its output is kept in `log`. */
function serve(port, file) {
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
      env: { ...process.env, PORT: String(port), KEEL_SECRET: SECRET },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const log = [];
  for (const out of [child.stdout, child.stderr]) out.on("data", (d) => log.push(...String(d).trim().split("\n")));
  child.once("error", (e) => log.push(String(e)));
  return { child, log };
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
  server = serve(port, join(tmp, "storage"));
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

  const json = { accept: "application/json", "content-type": "application/json", "x-keel": "1" };
  const write = await page.request.post(`${origin}/api/items`, { headers: json, data: { name: "Eggs" } });
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
} catch (e) {
  step("flow", false, clip(String(e).split("\n")[0]));
} finally {
  clearTimeout(limit);
  await browser?.close().catch(() => undefined);
  killServer();
  if (tmp !== undefined) await rm(tmp, { recursive: true, force: true });
}
finish("household");

// Built-run proof for the walkthrough app apps/household: its built `web` deployable (`pnpm --filter household build`)
// served on a free port with its data in a temporary folder (web storage, the sign-in library's `auth.sqlite`, and
// PGlite through `KEEL_POSTGRES_URL`), then driven in headless Chromium and over HTTP: the start page renders and the
// guard sends the list to sign-in; a sign-up and a sign-in go on to the list; the document links the entry
// stylesheet, the file is served as CSS and a styled element has a non-default computed style; the setup action writes
// the household name; the shopping menu adds through the API and the list survives a reload; an API write and the
// loader agree; the API refuses a request no member made; a cross-site write answers 403; a receipt form answered with
// a server error shows the typed values, `aria-invalid` and the error text, with scripts running and with scripts off;
// the profile page mints an API token that calls the API, and once revoked the token is refused; the frame's note on what
// the page records lists a phone number typed into the profile masked; values typed into the
// profile's personal fields reach no server log line and no file in the data folder but the database; no page error or
// console error. The server is then killed with SIGKILL with a write in flight and restarted, and the list, the
// receipts, the household name and the session are all there. A second member then opens the list in a second browser
// context: an item the first adds shows on her page with no reload, an item she buys moves on his, both pages say
// Connecting while the server is killed and Live once it is back, a mark she makes offline waits on her page and goes
// once she is back, a mark of an item changed meanwhile comes back refused and she applies it, and a sign-out in her other tab turns her page to
// Signed out with no new item on it. The first member then selects Run now on the setup page; the server is killed with
// SIGKILL while the weekly staples run goes and started again, and the run ends once, done, with each staple on the
// list once. When docker answers, the same kill and restart runs
// against a throwaway `postgres:17` container; the container is removed after.
// Usage: node --disable-warning=ExperimentalWarning tooling/smoke/household.mjs. The app is not built here and nothing
// is written inside the repo; the server child and the container are removed on every path, and a crash prints the
// steps it had. No database URL, password or token is printed.
import { execFile, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { fixedTime } from "../test-time.ts";
import { freePort, keepOutput, recorder, root, wait } from "./built.mjs";

const LIMIT_MS = fixedTime(300_000);
const SECRET = "household-smoke-secret-of-32-bytes-or-more";
const AUTH_SECRET = "household-smoke-auth-secret-of-32-or-more";
const PASSWORD = "smoke test passphrase";
const app = join(root, "apps", "household");
const { step, finish, caught } = recorder();
let server;
let browser;
let tmp;
let container;

/** Run `docker` with `args`; resolves its trimmed stdout, or null when it fails. */
const docker = (args) =>
  new Promise((resolve) =>
    execFile("docker", args, { timeout: fixedTime(60_000) }, (e, out) =>
      resolve(e === null ? String(out).trim() : null),
    ),
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
 * Start the built `web` deployable of the app on `port` with web storage in `file` (the sign-in library's
 * `auth.sqlite` beside it) and app data at `data` (`KEEL_POSTGRES_URL`); its output is kept in `log`.
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
      env: {
        ...process.env,
        PORT: String(port),
        KEEL_SECRET: SECRET,
        KEEL_POSTGRES_URL: data,
        BETTER_AUTH_SECRET: AUTH_SECRET,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const log = [];
  for (const out of [child.stdout, child.stderr]) out.on("data", (d) => log.push(...String(d).trim().split("\n")));
  child.once("error", (e) => log.push(String(e)));
  keepOutput("server", log);
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
async function up(url, ms = fixedTime(20_000)) {
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
/**
 * The page is loaded and its requests are quiet. The list page keeps its change stream open, so the network is never
 * idle there: past the load, at most 2.5 s are spent waiting for quiet.
 */
const settled = async (page) => {
  await page.waitForLoadState("load");
  await page.waitForLoadState("networkidle", { timeout: fixedTime(2_500) }).catch(() => undefined);
};
const clip = (v) => String(v).slice(0, 200);

const asJson = { accept: "application/json", "content-type": "application/json", "x-keel": "1" };
const sameSite = { "sec-fetch-site": "same-origin", "content-type": "application/x-www-form-urlencoded" };

/** The list as `GET /api/items` answers it to `auth` (a `cookie` or `authorization` header), or null. */
async function itemsAt(origin, auth) {
  const r = await fetch(`${origin}/api/items`, { headers: { accept: "application/json", ...auth } }).catch(() => null);
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

/** A native form post to `path` as a same-origin page sends it; resolves the response, or null. */
const formPost = (origin, path, fields, auth = {}) =>
  fetch(`${origin}${path}`, {
    method: "POST",
    headers: { ...sameSite, origin, ...auth },
    body: new URLSearchParams(fields).toString(),
    redirect: "manual",
  }).catch(() => null);

/** The `cookie` header that sends back what `res` set. */
const cookieOf = (res) => ({
  cookie: (res?.headers.getSetCookie() ?? []).map((c) => c.split(";")[0]).join("; "),
});

/** The household name `GET /api/household` answers to `auth`, or null. */
async function householdAt(origin, auth) {
  const r = await fetch(`${origin}/api/household`, { headers: { accept: "application/json", ...auth } }).catch(
    () => null,
  );
  return r === null || r.status !== 200 ? null : (await r.json()).results["setup.household"].value.name;
}

/** The totals the receipts page lists to `auth`, from its served HTML. */
async function totalsAt(origin, auth) {
  const html = await fetch(`${origin}/receipts`, { headers: { accept: "text/html", ...auth } }).then(
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
  for (const end = Date.now() + fixedTime(60_000); Date.now() < end; await wait(250)) {
    if ((await docker(["exec", id, "pg_isready", "-q", "-h", "127.0.0.1", "-U", "postgres"])) !== null)
      return `postgres://postgres:smoke@127.0.0.1:${port}/postgres`;
  }
  return null;
}

/** Every file under `dir`, but those under `skip`. */
async function filesUnder(dir, skip) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true, recursive: true })) {
    const path = join(e.parentPath, e.name);
    if (e.isFile() && !path.startsWith(skip)) out.push(path);
  }
  return out;
}

/** Sign in on `page` through the sign-in form, which it is on, and wait for the page it goes on to. */
async function signInOn(page, email) {
  await byId(page, "members.signinForm:email").fill(email);
  await byId(page, "members.signinForm:password").fill(PASSWORD);
  await Promise.all([
    page.waitForURL((u) => u.pathname !== "/signin", { timeout: fixedTime(10_000) }),
    byId(page, "members.signinSubmit").click(),
  ]);
  await settled(page);
}

/** Fill the setup form on `page` and wait for its done mark. */
async function setUp(page, origin, name) {
  await page.goto(`${origin}/setup`);
  await byId(page, "setup.form:name").fill(name);
  await byId(page, "setup.save").click();
  await byId(page, "setup.done").waitFor({ timeout: fixedTime(10_000) });
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
  const data = join(tmp, "data");
  await mkdir(data);
  const storage = join(data, "storage");
  const pglite = `pglite:${join(data, "postgres")}`;
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
  step("guard sends the list to sign-in", page.url() === `${origin}/signin?next=%2Flist`, page.url());
  await byId(page, "members.toSignup").click();
  await settled(page);
  await byId(page, "members.signupForm:name").fill("Ada Lovelace");
  await byId(page, "members.signupForm:email").fill("ada@example.com");
  await byId(page, "members.signupForm:password").fill(PASSWORD);
  await Promise.all([
    page.waitForURL((u) => u.pathname === "/signin", { timeout: fixedTime(10_000) }),
    byId(page, "members.signupSubmit").click(),
  ]);
  await signInOn(page, "ada@example.com");
  step("sign-up and sign-in go on to the list", page.url() === `${origin}/list`, page.url());
  const cookies = await page.context().cookies();
  step(
    "the session cookie is HttpOnly and SameSite=Lax",
    cookies.some((c) => c.name.includes("session") && c.httpOnly && c.sameSite === "Lax"),
    cookies.map((c) => c.name).join(","),
  );
  await setUp(page, origin, "Elm Street");
  const household = await page.request.get(`${origin}/api/household`, { headers: { accept: "application/json" } });
  const named = clip(await household.text());
  step("setup action writes the name", household.status() === 200 && named.includes("Elm Street"), named);

  await page.goto(`${origin}/receipts`);
  await settled(page);
  const padding = await byId(page, "frame.main").evaluate((e) => getComputedStyle(e).padding);
  step("a styled element has a non-default computed style", padding !== "0px" && padding !== "", `padding ${padding}`);
  const serif = await byId(page, "frame").evaluate(async (e) => {
    await document.fonts.ready;
    return [getComputedStyle(e).fontFamily, document.fonts.check('17px "Source Serif 4"')];
  });
  step(
    "the frame sets the brand serif and it loads",
    serif[0].startsWith('"Source Serif 4"') && serif[1],
    serif.join(" "),
  );

  await page.goto(`${origin}/list`);
  await settled(page);
  const list = await page.title();
  step("list title", list === "Shopping list", list);
  const row = page.locator("[id^='shopping.name.']").first();
  for (let i = 0; i < 2; i++) {
    await byId(page, "shopping.staples.trigger").click();
    await byId(page, "shopping.staples.item.milk").click();
    if (i === 0) await row.waitFor({ timeout: fixedTime(10_000) });
  }
  await row.filter({ hasText: "× 2" }).waitFor({ timeout: fixedTime(10_000) });
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

  const anonymous = await fetch(`${origin}/api/items`, { headers: { accept: "application/json" } }).then(
    (r) => r.status,
    () => 0,
  );
  step("the API refuses a request no member made", anonymous === 403, String(anonymous));

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
  await page
    .locator("[id^='receipts.total.']")
    .first()
    .waitFor({ timeout: fixedTime(10_000) });
  const totals = await page.locator("[id^='receipts.total.']").allTextContents();
  step("form records a receipt", totals.includes("€3.50"), totals.join(","));

  const on = await rejected(page);
  step(
    "rejected form keeps the typed values and shows the error, scripts on",
    on.shop === "Market" && on.amount === "3.555" && on.invalid === "true" && on.error !== "",
    JSON.stringify(on),
  );

  await page.goto(`${origin}/profile`);
  await settled(page);
  await byId(page, "members.mint").click();
  await byId(page, "members.minted").waitFor({ timeout: fixedTime(10_000) });
  const token = ((await byId(page, "members.minted").textContent()) ?? "").trim();
  await byId(page, "members.token.0").waitFor({ timeout: fixedTime(10_000) });
  const bearer = { authorization: `Bearer ${token}` };
  const called = (await itemsAt(origin, bearer)) ?? [];
  step(
    "a minted token calls the API as the member",
    token.startsWith("keel_") && called.some((i) => i.name === "Milk"),
    `${token === "" ? "no token" : "token shown"}, ${called.length} items`,
  );
  await byId(page, "members.revoke.0").click();
  await byId(page, "members.tokens.none").waitFor({ timeout: fixedTime(10_000) });
  const refused = await fetch(`${origin}/api/items`, { headers: { accept: "application/json", ...bearer } }).then(
    (r) => r.status,
    () => 0,
  );
  step("a revoked token is refused", refused === 403, String(refused));

  const canary = { name: "Quillon Vantablack", phone: "+44 7700 900417" };
  await byId(page, "members.profileForm:name").fill(canary.name);
  await byId(page, "app.recording.note.button").click();
  await byId(page, "members.profileForm:phone").fill(canary.phone);
  const masked = `input members.profileForm:phone "${"x".repeat(canary.phone.length)}"`;
  const noted = await byId(page, "app.recording.events")
    .filter({ hasText: masked })
    .waitFor({ timeout: fixedTime(10_000) })
    .then(
      () => byId(page, "app.recording.events").innerText(),
      () => "",
    );
  step(
    "the frame's note lists the typed phone as the recorder kept it, masked",
    noted.includes(masked) && Object.values(canary).every((v) => !noted.includes(v)),
    clip(noted.split("\n").at(-1) ?? ""),
  );
  await byId(page, "members.save").click();
  await byId(page, "members.saved").waitFor({ timeout: fixedTime(10_000) });
  await page.reload();
  await settled(page);
  const typed = await byId(page, "members.profileForm:phone").inputValue();
  const files = await filesUnder(data, join(data, "postgres"));
  const leaks = [];
  for (const f of files) {
    const bytes = await readFile(f);
    for (const v of Object.values(canary)) if (bytes.includes(v)) leaks.push(`${f.slice(data.length + 1)} has ${v}`);
  }
  for (const v of Object.values(canary)) if (server.log.some((l) => l.includes(v))) leaks.push(`log has ${v}`);
  step(
    "typed personal data reaches no log line and no data file but the database",
    typed === canary.phone && files.length > 0 && leaks.length === 0,
    clip(leaks.length === 0 ? `${files.length} files, ${server.log.length} log lines` : leaks.join(" | ")),
  );
  step("no page errors", errors.length === 0, clip(errors.join(" | ")));
  await byId(page, "members.mint").click();
  await byId(page, "members.minted").waitFor({ timeout: fixedTime(10_000) });
  const keep = { authorization: `Bearer ${((await byId(page, "members.minted").textContent()) ?? "").trim()}` };

  const plain = await browser.newContext({ javaScriptEnabled: false });
  const bare = await plain.newPage();
  await bare.goto(`${origin}/setup`);
  await signInOn(bare, "ada@example.com");
  await setUp(bare, origin, "Oak Road");
  await bare.goto(`${origin}/receipts`);
  const off = await rejected(bare);
  step(
    "rejected form keeps the typed values and shows the error, scripts off",
    off.shop === "Market" && off.amount === "3.555" && off.invalid === "true" && off.error !== "",
    JSON.stringify(off),
  );
  await plain.close();

  const rice = await fetch(`${origin}/api/items`, {
    method: "POST",
    headers: { ...asJson, ...keep },
    body: '{"name":"Rice"}',
  });
  const inFlight = fetch(`${origin}/api/items`, {
    method: "POST",
    headers: { ...asJson, ...keep },
    body: '{"name":"Flour"}',
  }).catch(() => null);
  const back = await restart(port, storage, pglite);
  await inFlight;
  step("restart after SIGKILL with a write in flight", rice.status === 200 && back, server.log.slice(-2).join(" | "));
  const after = (await itemsAt(origin, keep)) ?? [];
  const names = after.map((i) => i.name);
  step(
    "PGlite keeps the list through the kill, rules intact",
    ["Milk", "Eggs", "Rice"].every((n) => names.includes(n)) && holds(after),
    clip(names.join(",")),
  );
  const keptTotals = await totalsAt(origin, keep);
  const keptName = await householdAt(origin, keep);
  step(
    "PGlite keeps the receipts and the store keeps the name",
    keptTotals.includes("€3.50") && keptName === "Oak Road",
    `${keptTotals.join(",")} ${keptName}`,
  );
  await page.goto(`${origin}/profile`);
  await settled(page);
  step("the session outlives the restart", new URL(page.url()).pathname === "/profile", page.url());

  // Two members with the list open in two browser contexts: Ada's change shows on Grace's page with no reload, both
  // say so through a kill and a restart, and a member signed out in another tab gets no list.
  const graceContext = await browser.newContext();
  const grace = await graceContext.newPage();
  grace.on("pageerror", (e) => errors.push(String(e).split("\n")[0]));
  await grace.goto(`${origin}/signup`);
  await byId(grace, "members.signupForm:name").fill("Grace Hopper");
  await byId(grace, "members.signupForm:email").fill("grace@example.com");
  await byId(grace, "members.signupForm:password").fill(PASSWORD);
  await Promise.all([
    grace.waitForURL((u) => u.pathname === "/signin", { timeout: fixedTime(10_000) }),
    byId(grace, "members.signupSubmit").click(),
  ]);
  await signInOn(grace, "grace@example.com");
  await grace.goto(`${origin}/list`);
  await page.goto(`${origin}/list`);
  const both = [page, grace];
  for (const p of both) await p.evaluate(() => Object.assign(window, { smokeMark: "kept" }));
  const statusOf = (p) =>
    byId(p, "shopping.live")
      .textContent()
      .then((t) => (t ?? "").trim());
  const until = async (p, word, ms) => {
    for (const end = Date.now() + ms; Date.now() < end; await wait(100)) {
      if ((await statusOf(p)).startsWith(word)) return true;
    }
    return false;
  };
  const liveBoth = (await until(page, "Live", fixedTime(10_000))) && (await until(grace, "Live", fixedTime(10_000)));
  step("both pages say Live", liveBoth, `${await statusOf(page)} / ${await statusOf(grace)}`);
  const rowIn = (p, name) => p.locator("[id^='shopping.name.']", { hasText: name });
  await byId(page, "shopping.staples.trigger").click();
  await byId(page, "shopping.staples.item.bread").click();
  const seen = await rowIn(grace, "Bread")
    .waitFor({ timeout: fixedTime(10_000) })
    .then(
      () => true,
      () => false,
    );
  const noReload = await grace.evaluate(() => Reflect.get(window, "smokeMark") === "kept");
  step("Ada adds Bread and Grace's page shows it with no reload", seen && noReload, `shown ${seen}, kept ${noReload}`);
  const breadId = ((await rowIn(grace, "Bread").getAttribute("id")) ?? "").slice("shopping.name.".length);
  await byId(grace, `shopping.toggle.${breadId}`).click();
  const bought = await byId(page, `shopping.toggle.${breadId}`).filter({ hasText: "Back on the list" });
  await byId(page, "shopping.view.tab.bought").click();
  const moved = await bought.waitFor({ timeout: fixedTime(10_000) }).then(
    () => true,
    () => false,
  );
  step("Grace buys it and Ada's page moves it to Bought", moved);

  await killed();
  const dropped =
    (await until(page, "Connecting", fixedTime(15_000))) && (await until(grace, "Connecting", fixedTime(15_000)));
  step(
    "both pages say Connecting once the server is gone",
    dropped,
    `${await statusOf(page)} / ${await statusOf(grace)}`,
  );
  server = serve(port, storage, pglite);
  const upAgain = await up(`${origin}/`);
  const recovered =
    upAgain && (await until(page, "Live", fixedTime(45_000))) && (await until(grace, "Live", fixedTime(45_000)));
  step("both pages say Live again after the restart", recovered, `${await statusOf(page)} / ${await statusOf(grace)}`);
  await byId(page, "shopping.staples.trigger").click();
  await byId(page, "shopping.staples.item.apples").click();
  const reached = await rowIn(grace, "Apples")
    .waitFor({ timeout: fixedTime(10_000) })
    .then(
      () => true,
      () => false,
    );
  const stillKept = await grace.evaluate(() => Reflect.get(window, "smokeMark") === "kept");
  step("after the restart Ada's add reaches Grace's page", reached && stillKept, `shown ${reached}, kept ${stillKept}`);

  await graceContext.setOffline(true);
  const offline = await until(grace, "Offline", fixedTime(10_000));
  await graceContext.setOffline(false);
  const online = await until(grace, "Live", fixedTime(45_000));
  step("Grace's browser offline says Offline, and Live once it is back", offline && online, await statusOf(grace));

  // The outbox: a mark Grace makes offline waits on her page and goes once she is back; a mark of an item Ada changed
  // meanwhile comes back refused with 409 and is applied when Grace chooses to.
  const itemNamed = async (name) => ((await itemsAt(origin, keep)) ?? []).find((i) => i.name === name);
  const serverHas = async (name, bought, ms) => {
    for (const end = Date.now() + ms; Date.now() < end; await wait(100)) {
      if ((await itemNamed(name))?.bought === bought) return true;
    }
    return false;
  };
  const apples = await itemNamed("Apples");
  await graceContext.setOffline(true);
  await until(grace, "Offline", fixedTime(10_000));
  await byId(grace, `shopping.toggle.${apples?.id}`).click();
  const waitingText = await byId(grace, `shopping.waiting.${apples?.id}`)
    .filter({ hasText: "waiting to send" })
    .waitFor({ timeout: fixedTime(10_000) })
    .then(
      () => true,
      () => false,
    );
  const heldBack = (await itemNamed("Apples"))?.bought === false;
  await graceContext.setOffline(false);
  const sent = await serverHas("Apples", true, fixedTime(30_000));
  step(
    "a mark made offline waits on Grace's page and goes once she is back",
    apples !== undefined && waitingText && heldBack && sent,
    `waiting ${waitingText}, held ${heldBack}, sent ${sent}`,
  );

  await fetch(`${origin}/api/items`, {
    method: "POST",
    headers: { ...asJson, ...keep },
    body: JSON.stringify({ name: "Oats" }),
  });
  await rowIn(grace, "Oats").waitFor({ timeout: fixedTime(10_000) });
  const oats = await itemNamed("Oats");
  await graceContext.setOffline(true);
  await until(grace, "Offline", fixedTime(10_000));
  await byId(grace, `shopping.toggle.${oats?.id}`).click();
  await fetch(`${origin}/api/items`, {
    method: "POST",
    headers: { ...asJson, ...keep },
    body: JSON.stringify({ name: "Oats" }),
  });
  await graceContext.setOffline(false);
  const why = grace.locator("[id^='shopping.outbox.why.']");
  const refusedShown = await why
    .filter({ hasText: "Oats × 2: someone at home changed this item" })
    .waitFor({ timeout: fixedTime(30_000) })
    .then(
      () => true,
      () => false,
    );
  const notYet = (await itemNamed("Oats"))?.bought === false;
  await grace.locator("[id^='shopping.outbox.mine.']").click();
  const applied = await serverHas("Oats", true, fixedTime(10_000));
  const cleared = await why.waitFor({ state: "detached", timeout: fixedTime(10_000) }).then(
    () => true,
    () => false,
  );
  step(
    "a mark of an item changed at home is shown refused, and Grace applies it over the change",
    refusedShown && notYet && applied && cleared,
    `shown ${refusedShown}, held ${notYet}, applied ${applied}, cleared ${cleared}`,
  );

  const elsewhere = await graceContext.newPage();
  await elsewhere.goto(`${origin}/list`);
  await Promise.all([
    elsewhere.waitForURL((u) => u.pathname === "/signin", { timeout: fixedTime(10_000) }),
    byId(elsewhere, "app.nav.signOut").click(),
  ]);
  // The next change closes Grace's stream `denied`: her page says Signed out within about a second of Ada's add.
  await byId(page, "shopping.staples.trigger").click();
  const asked = Date.now();
  await byId(page, "shopping.staples.item.rice").click();
  const out = await until(grace, "Signed out", fixedTime(2_000));
  const took = Date.now() - asked;
  // Rice is on the list from the kill above: Ada's add raises it to 2, which Grace's page must not show.
  const leaked = await rowIn(grace, "Rice × 2").count();
  step(
    "signed out in another tab, Grace's page says so and gets no new item",
    out && leaked === 0,
    `${await statusOf(grace)} after ${took} ms, rows with Rice × 2: ${leaked}`,
  );
  step("no page errors with two members", errors.length === 0, clip(errors.join(" | ")));
  await graceContext.close();

  // The weekly staples: Run now on the setup page, SIGKILL while the run goes, a restart over the same storage and
  // data, and the run ends once, each staple on the list once.
  for (const item of (await itemsAt(origin, keep)) ?? []) {
    await fetch(`${origin}/api/items/${item.id}`, { method: "DELETE", headers: { ...asJson, ...keep } });
  }
  const runsAt = async () => {
    const r = await fetch(`${origin}/api/restock`, { headers: { accept: "application/json", ...keep } }).catch(
      () => null,
    );
    return r === null || r.status !== 200 ? null : (await r.json()).results["shopping.runs"].value;
  };
  const lastOf = (p) =>
    byId(p, "shopping.restock.last")
      .textContent()
      .then((t) => (t ?? "").trim());
  const showing = async (p, word, ms) => {
    for (const end = Date.now() + ms; Date.now() < end; await wait(100)) {
      if ((await lastOf(p)).startsWith(word)) return true;
    }
    return false;
  };
  await page.goto(`${origin}/setup`);
  await settled(page);
  const before = await lastOf(page);
  step("the setup page says no run yet", before.startsWith("No run yet"), before);
  await byId(page, "shopping.restock.run").click();
  const running = await showing(page, "Running", fixedTime(10_000));
  let midRun = null;
  for (const end = Date.now() + fixedTime(15_000); Date.now() < end && midRun === null; await wait(100)) {
    const r = await runsAt();
    if (r?.last !== null && r?.last !== undefined && r.last.handled >= 1 && r.last.state === "running") midRun = r;
  }
  await killed();
  step(
    "Run now starts a run, and the server is killed while it goes",
    running && midRun !== null,
    midRun === null ? await lastOf(page) : `${midRun.last.handled} of ${midRun.last.total} handled at the kill`,
  );
  server = serve(port, storage, pglite);
  const restarted = await up(`${origin}/`);
  // The run's own time is an input, no bound: a step the killed server held runs again after its 10 s timeout and a
  // second (11 s), and four 2 s waits lie between the five staples (8 s); 60 s is the allowance on top.
  const done = restarted && (await showing(page, "Done", fixedTime(19_000) + fixedTime(60_000)));
  const final = await runsAt();
  step(
    "after the restart the run ends once, done, and the page shows it",
    done && final?.kept === 1 && final?.last?.state === "done" && final?.last?.putBack === 5,
    `${await lastOf(page)} kept ${final?.kept}`,
  );
  const restocked = ((await itemsAt(origin, keep)) ?? []).map((i) => `${i.name} × ${i.qty}`);
  step(
    "the list shows each staple once",
    JSON.stringify(restocked) === JSON.stringify(["Milk × 1", "Bread × 1", "Eggs × 1", "Rice × 1", "Apples × 1"]),
    restocked.join(","),
  );
  step("no page errors through the weekly run", errors.length === 0, clip(errors.join(" | ")));

  if ((await docker(["info", "--format", "{{.ServerVersion}}"])) === null) {
    step("postgres 17 skipped: docker is not running", true);
  } else {
    const url = await postgres17();
    step("postgres 17 container takes connections", url !== null);
    if (url !== null) {
      await killed();
      const pgPort = await freePort();
      const pgOrigin = `http://127.0.0.1:${pgPort}`;
      const pgData = join(tmp, "data-17");
      await mkdir(pgData);
      const pgStorage = join(pgData, "storage");
      server = serve(pgPort, pgStorage, url);
      const served17 = await up(`${pgOrigin}/`);
      const account = { name: "Sam Smoke", email: "sam@example.com", password: PASSWORD };
      await formPost(pgOrigin, "/api/auth/sign-up/email", account);
      const session = cookieOf(
        await formPost(pgOrigin, "/api/auth/sign-in/email", { email: account.email, password: PASSWORD }),
      );
      const named = (await formPost(pgOrigin, "/setup", { name: "Birch Lane" }, session))?.status;
      const added = await fetch(`${pgOrigin}/api/items`, {
        method: "POST",
        headers: { ...asJson, ...session },
        body: '{"name":"Tea"}',
      });
      const paid = (
        await formPost(
          pgOrigin,
          "/receipts",
          { shop: "Bakery", amount: "4.20", currency: "EUR", paidBy: "sam" },
          session,
        )
      )?.status;
      step(
        "postgres 17 serves the app, signs in and takes writes",
        served17 && session.cookie !== "" && named === 303 && added.status === 200 && paid === 303,
        `setup ${named}, item ${added.status}, receipt ${paid}`,
      );
      const again = await restart(pgPort, pgStorage, url);
      const tea = ((await itemsAt(pgOrigin, session)) ?? []).map((i) => i.name);
      const pgTotals = await totalsAt(pgOrigin, session);
      step(
        "postgres 17 keeps the list and the receipts through a SIGKILL and restart",
        again && tea.includes("Tea") && pgTotals.includes("€4.20"),
        `${tea.join(",")} ${pgTotals.join(",")}`,
      );
    }
  }
} catch (e) {
  caught(e);
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

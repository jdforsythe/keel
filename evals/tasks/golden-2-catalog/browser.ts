// The browser pass of evals/tasks/golden-2-catalog (TASK.md "Acceptance" 5): serve the built `dist/api/server.mjs`
// (the `api` deployable, which also serves the `web` client), seed the twelve-recipe fixture through its endpoints,
// then on Chromium and WebKit (the engines in the local Playwright cache; it downloads nothing) walk the catalog's
// widgets by keyboard: the finder, the currency filter, a sort link, the pager, row selection and its toast, the tabs,
// the alert dialog (Tab stays inside it while open) and a row menu. One walk watches for `securitypolicyviolation`
// events and page errors; a second, in a context with `bypassCSP`, loads axe-core after every step and runs its
// `color-contrast` rule, which the harness replaces with token contrast in tests. `browserPass` resolves to undefined
// when all of that holds, else one short reason.
import { type ChildProcess, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { access, mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Browser, type BrowserType, type Page, chromium, webkit } from "@playwright/test";

const PORT = 4198;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const STEP_MS = 10_000;
const FIXTURE: readonly (readonly [string, number, number, string])[] = [
  ["Apple pie", 75, 1200, "EUR"],
  ["Borscht", 90, 900, "USD"],
  ["Curry udon", 25, 1100, "JPY"],
  ["Dal", 40, 700, "EUR"],
  ["Empanadas", 60, 1500, "USD"],
  ["Focaccia", 120, 600, "JPY"],
  ["Gazpacho", 20, 800, "EUR"],
  ["Hummus", 15, 500, "USD"],
  ["Irish stew", 150, 1400, "JPY"],
  ["Jambalaya", 55, 1300, "EUR"],
  ["Kimchi", 45, 400, "USD"],
  ["Lasagne", 95, 1000, "JPY"],
];

const exists = (p: string): Promise<boolean> =>
  access(p).then(
    () => true,
    () => false,
  );

/** Resolves true once the server prints `listening`, false if it exits or `STEP_MS * 2` passes first. */
const listening = (server: ChildProcess): Promise<boolean> =>
  new Promise((resolve) => {
    const signal = AbortSignal.timeout(STEP_MS * 2);
    signal.addEventListener("abort", () => resolve(false));
    server.stdout?.on("data", (d) => {
      if (String(d).includes("listening")) resolve(true);
    });
    server.on("exit", () => resolve(false));
  });

/** Posts the fixture through the api, as the services client sends it; returns false on any non-200. */
async function seed(): Promise<boolean> {
  const headers = { accept: "application/json", "content-type": "application/json", "x-keel": "1", origin: ORIGIN };
  for (const [title, minutes, amount, currency] of FIXTURE) {
    const body = JSON.stringify({ title, minutes, price: { amount, currency } });
    const res = await fetch(`${ORIGIN}/api/recipes`, { method: "POST", headers, body });
    if (res.status !== 200) return false;
  }
  return true;
}

const sel = (id: string): string => `[id="${id}"]`;
const focusedId = (page: Page): Promise<string> => page.evaluate(() => document.activeElement?.id ?? "");

/** Collects `securitypolicyviolation` events and page errors of `page` across its navigations. */
async function watch(page: Page, found: string[]): Promise<void> {
  page.on("pageerror", (e) => found.push(`pageerror ${String(e).split("\n")[0] ?? ""}`));
  await page.exposeFunction("__keelCspViolation", (directive: string, blocked: string) =>
    found.push(`securitypolicyviolation ${directive} ${blocked} at ${new URL(page.url()).pathname}`),
  );
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (e) => {
      const report = Reflect.get(globalThis, "__keelCspViolation");
      if (typeof report === "function") report(e.violatedDirective, e.blockedURI);
    });
  });
}

/** axe-core's `color-contrast` on the page as it is now; one entry per violated rule. */
async function contrastOf(page: Page, axe: string, step: string): Promise<string[]> {
  await page.addScriptTag({ path: axe });
  const rules = await page.evaluate(async () => {
    const engine: unknown = Reflect.get(globalThis, "axe");
    const run: unknown = typeof engine === "object" && engine !== null ? Reflect.get(engine, "run") : undefined;
    if (typeof run !== "function") return ["axe-core did not load"];
    const options = { runOnly: { type: "rule", values: ["color-contrast"] } };
    const result: unknown = await Reflect.apply(run, engine, [document, options]);
    const violations: unknown = typeof result === "object" && result !== null ? Reflect.get(result, "violations") : [];
    return Array.isArray(violations) ? violations.map((v: unknown) => String(Reflect.get(Object(v), "id"))) : [];
  });
  return rules.map((r) => `${r} at ${step}`);
}

/** Fails the step unless `cond` holds within `STEP_MS`. */
async function until(page: Page, what: string, cond: () => Promise<boolean>): Promise<void> {
  const end = performance.now() + STEP_MS;
  while (performance.now() < end) {
    if (await cond()) return;
    await page.waitForTimeout(50);
  }
  throw new Error(`timed out: ${what}`);
}

/** The keyboard journey on one page; `check(step)` runs after each widget state. */
async function journey(page: Page, check: (step: string) => Promise<void>): Promise<void> {
  const catalog = async (): Promise<void> => {
    await page.goto(`${ORIGIN}/catalog`, { waitUntil: "load" });
    await page.locator(sel("recipes.table.status")).waitFor({ timeout: STEP_MS });
  };
  await catalog();
  await check("catalog");
  // Finder.
  await page.focus(sel("recipes.find.input"));
  await page.keyboard.press("ArrowDown");
  await check("finder open");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await until(page, "finder opens a recipe", async () => (await focusedId(page)) === "recipes.show.heading");
  // Currency filter.
  await catalog();
  await page.focus(sel("recipes.catalogFilters.button"));
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await until(page, "listbox focused", async () => (await focusedId(page)) === "recipes.currency.list");
  await check("filters open");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await until(page, "currency in the URL", async () => new URL(page.url()).searchParams.get("currency") === "EUR");
  // Sort.
  await catalog();
  await page.focus(sel("recipes.table.sort.price"));
  await page.keyboard.press("Enter");
  await until(
    page,
    "price sorted ascending",
    async () => (await page.getAttribute(sel("recipes.table.header.price"), "aria-sort")) === "ascending",
  );
  if ((await focusedId(page)) !== "recipes.table.sort.price") throw new Error("focus left the sort link");
  await check("sorted");
  // Pager.
  await catalog();
  await page.focus(sel("recipes.table.next"));
  await page.keyboard.press("Enter");
  await until(page, "page 2", async () => new URL(page.url()).searchParams.get("page") === "2");
  await page.focus(sel("recipes.table.next"));
  await page.keyboard.press("Enter");
  await until(page, "page 3 with focus on status", async () => (await focusedId(page)) === "recipes.table.status");
  // Selection and toast.
  await catalog();
  const boxes = page.locator('[id^="recipes.table.select."]');
  await boxes.nth(1).focus();
  await page.keyboard.press("Space");
  await boxes.nth(3).focus();
  await page.keyboard.press("Space");
  await check("two selected");
  await page.focus(sel("recipes.addSelected"));
  await page.keyboard.press("Enter");
  const dismiss = page.locator('[id^="recipes.toaster.dismiss."]').first();
  await dismiss.waitFor({ timeout: STEP_MS });
  await check("toast");
  await dismiss.focus();
  await page.keyboard.press("Enter");
  await dismiss.waitFor({ state: "detached", timeout: STEP_MS });
  // Tabs and the alert dialog.
  await page.focus(sel("recipes.views.tab.recipes"));
  await page.keyboard.press("ArrowRight");
  await page.locator(sel("recipes.views.panel.list")).waitFor({ timeout: STEP_MS });
  await check("list tab");
  await page.focus(sel("recipes.clear.trigger"));
  await page.keyboard.press("Enter");
  await until(page, "dialog focuses its first button", async () => (await focusedId(page)) === "recipes.clear.cancel");
  await check("dialog open");
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press("Tab");
    const inside = await page.evaluate(
      () => document.getElementById("recipes.clear.dialog")?.contains(document.activeElement) === true,
    );
    if (!inside) throw new Error("Tab left the open dialog");
  }
  await page.keyboard.press("Escape");
  await until(page, "Escape returns focus", async () => (await focusedId(page)) === "recipes.clear.trigger");
  // Row menu.
  await catalog();
  const trigger = page.locator('[id^="recipes.menu."][id$=".trigger"]').first();
  await trigger.focus();
  await page.keyboard.press("ArrowDown");
  await check("menu open");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await until(page, "menu opens the de-DE recipe", async () => new URL(page.url()).pathname.startsWith("/de-DE/recipes/"));
}

/** Runs the pass against `app` (its `dist/api/server.mjs`), with axe-core resolved from `@keel/testing` under `root`. */
export async function browserPass(root: string, app: string): Promise<string | undefined> {
  const entry = join(app, "dist", "api", "server.mjs");
  if (!(await exists(entry))) return "dist/api/server.mjs is absent";
  const engines: readonly (readonly [string, BrowserType])[] = [
    ["chromium", chromium],
    ["webkit", webkit],
  ];
  for (const [name, engine] of engines)
    if (!(await exists(engine.executablePath()))) return `${name} is not in the Playwright cache`;
  const axe = createRequire(join(root, "packages", "testing", "package.json")).resolve("axe-core/axe.min.js");
  const dir = await mkdtemp(join(tmpdir(), "golden-2-catalog-browser-"));
  const storage = `--localstorage-file=${join(dir, "api.storage")}`;
  const log: string[] = [];
  const server = spawn("node", ["--experimental-webstorage", storage, "--disable-warning=ExperimentalWarning", entry], {
    cwd: app,
    env: {
      ...process.env,
      PORT: String(PORT),
      KEEL_SECRET: randomBytes(32).toString("base64url"),
      KEEL_ORIGIN: ORIGIN,
    },
  });
  server.stdout.on("data", (d) => log.push(...String(d).split("\n")));
  const problems: string[] = [];
  try {
    if (!(await listening(server))) return `server did not listen on ${ORIGIN}`;
    if (!(await seed())) return "the api refused the fixture";
    for (const [name, engine] of engines) {
      const browser: Browser = await engine.launch();
      try {
        const strict = await (await browser.newContext()).newPage();
        const found: string[] = [];
        await watch(strict, found);
        await journey(strict, async () => undefined);
        for (const p of found) problems.push(`${name} ${p}`);
        const bypass = await (await browser.newContext({ bypassCSP: true })).newPage();
        const contrast: string[] = [];
        await journey(bypass, async (step) => {
          contrast.push(...(await contrastOf(bypass, axe, step)));
        });
        for (const p of contrast) problems.push(`${name} ${p}`);
      } catch (e) {
        problems.push(`${name} journey stopped: ${String(e).split("\n")[0] ?? ""}`);
      } finally {
        await browser.close();
      }
    }
  } finally {
    if (server.exitCode === null && server.signalCode === null) {
      const exited = new Promise((resolve) => server.on("exit", resolve));
      server.kill("SIGTERM");
      await exited;
    }
    await rm(dir, { recursive: true, force: true });
  }
  for (const line of log) if (/^csp\b|"kind":"csp"/.test(line)) problems.push(`server logged ${line.slice(0, 80)}`);
  return problems.length === 0 ? undefined : `${problems.length} problem(s), first: ${problems[0] ?? ""}`;
}

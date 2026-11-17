// The browser pass of evals/tasks/golden-3 (TASK.md "Acceptance" 8): serve the built `dist/web/server.mjs`, then on
// Chromium and WebKit (the engines in the local Playwright cache; it downloads nothing) walk the journey: sign up, list
// mine, cancel, sign up again, and the organizer's roster and attendance. No page may raise a `securitypolicyviolation`
// event or a page error, and the server log may hold no `csp` record. A second context with `bypassCSP` loads axe-core
// into each page and runs its `color-contrast` rule, which the render check replaces with token contrast in tests.
// `browserPass` resolves to undefined when all of that holds, else one short reason.
import { type ChildProcess, execFile, spawn } from "node:child_process";
import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Browser, type BrowserType, type Page, chromium, webkit } from "@playwright/test";

const PORT = 4197;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const STEP_MS = 10_000;
const PAGES = ["/", "/shifts/s1", "/mine", "/roster"] as const;

const exists = (p: string): Promise<boolean> =>
  access(p).then(
    () => true,
    () => false,
  );

const node = (args: string[], env: Record<string, string>): Promise<boolean> =>
  new Promise((resolve) =>
    execFile("node", args, { env: { ...process.env, ...env } }, (error) => resolve(error === null)),
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

const id = (raw: string): string => `#${raw.replaceAll(".", "\\.").replaceAll(":", "\\:")}`;

/** The journey on one engine; returns the violations and errors it saw. */
async function journey(browser: Browser, organizer: string): Promise<string[]> {
  const found: string[] = [];
  const volunteer = await (await browser.newContext()).newPage();
  await watch(volunteer, found);
  const signUp = async (shift: string): Promise<void> => {
    await volunteer.goto(`${ORIGIN}/`, { waitUntil: "load" });
    await volunteer.click(id(`shifts.link.${shift}`));
    await volunteer.locator(id("shifts.show.title")).waitFor({ timeout: STEP_MS });
    await volunteer.getByLabel("Name").fill("Grace Hopper");
    await volunteer.getByLabel("Email").fill("grace@example.org");
    await volunteer.getByLabel("Phone (optional)").fill("555 0100");
    await volunteer.getByLabel("Access needs (optional)").fill("Step-free entrance");
    await volunteer.click(id("shifts.join.submit"));
    await volunteer.locator(id("shifts.mine.title")).waitFor({ timeout: STEP_MS });
  };
  await signUp("s1");
  await volunteer.locator('[id^="shifts.mine.cancel."]').first().click();
  await volunteer.click(id("shifts.cancel"));
  await volunteer.locator(id("shifts.mine.empty")).waitFor({ timeout: STEP_MS });
  await signUp("s2");
  const context = await browser.newContext();
  await context.addCookies([{ name: "keel-caller", value: organizer, url: ORIGIN }]);
  const roster = await context.newPage();
  await watch(roster, found);
  await roster.goto(`${ORIGIN}/roster`, { waitUntil: "load" });
  await roster.locator(id("shifts.roster.title")).waitFor({ timeout: STEP_MS });
  await roster.locator('[id^="shifts.roster.mark."]').first().click();
  await roster.getByLabel("Attended").check();
  await roster.click(id("shifts.attend.save"));
  await roster
    .locator('[id^="shifts.roster.attended."]', { hasText: "Attended" })
    .first()
    .waitFor({ timeout: STEP_MS });
  return found;
}

/** axe-core's `color-contrast` on each page (and one attendance page) in a context that bypasses the policy. */
async function contrast(browser: Browser, organizer: string, axe: string): Promise<string[]> {
  const found: string[] = [];
  const context = await browser.newContext({ bypassCSP: true });
  await context.addCookies([{ name: "keel-caller", value: organizer, url: ORIGIN }]);
  const page = await context.newPage();
  await page.goto(`${ORIGIN}/roster`, { waitUntil: "load" });
  const mark = await page.locator('[id^="shifts.roster.mark."]').first().getAttribute("href");
  for (const path of [...PAGES, ...(mark === null ? [] : [mark])]) {
    await page.goto(new URL(path, ORIGIN).href, { waitUntil: "load" });
    // Evaluated over the debugging protocol: a script element built from a string would break Trusted Types.
    await page.evaluate(await readFile(axe, "utf8"));
    const rules = await page.evaluate(async () => {
      const engine: unknown = Reflect.get(globalThis, "axe");
      const run: unknown = typeof engine === "object" && engine !== null ? Reflect.get(engine, "run") : undefined;
      if (typeof run !== "function") return ["axe-core did not load"];
      const options = { runOnly: { type: "rule", values: ["color-contrast"] } };
      const result: unknown = await Reflect.apply(run, engine, [document, options]);
      const violations: unknown =
        typeof result === "object" && result !== null ? Reflect.get(result, "violations") : [];
      return Array.isArray(violations) ? violations.map((v: unknown) => String(Reflect.get(Object(v), "id"))) : [];
    });
    for (const r of rules) found.push(`${r} at ${new URL(path, ORIGIN).pathname}`);
  }
  await context.close();
  return found;
}

/**
 * Runs the pass against `app` (its `dist/web/server.mjs`), with axe-core resolved from `@keel/testing` under `root`.
 * The organizer is a caller cookie signed under a fresh `KEEL_SECRET`, whose hash is stored under `shifts.organizers`
 * in the server's storage file before the server starts.
 */
export async function browserPass(root: string, app: string): Promise<string | undefined> {
  const entry = join(app, "dist", "web", "server.mjs");
  if (!(await exists(entry))) return "dist/web/server.mjs is absent";
  const engines: readonly (readonly [string, BrowserType])[] = [
    ["chromium", chromium],
    ["webkit", webkit],
  ];
  for (const [name, engine] of engines)
    if (!(await exists(engine.executablePath()))) return `${name} is not in the Playwright cache`;
  const axe = createRequire(join(root, "packages", "testing", "package.json")).resolve("axe-core/axe.min.js");
  const secret = randomBytes(32).toString("base64url");
  const token = randomUUID();
  const organizer = `${token}.${createHmac("sha256", secret).update(token).digest("base64url")}`;
  const hash = createHash("sha256").update(organizer).digest("base64url");
  const dir = await mkdtemp(join(tmpdir(), "golden-3-browser-"));
  const storage = `--localstorage-file=${join(dir, "web.storage")}`;
  const seeded = await node(
    [
      "--experimental-webstorage",
      storage,
      "--disable-warning=ExperimentalWarning",
      "-e",
      "localStorage.setItem('shifts.organizers', process.env.KEEL_ORGANIZERS)",
    ],
    { KEEL_ORGANIZERS: JSON.stringify([hash]) },
  );
  if (!seeded) return "could not seed shifts.organizers";
  const log: string[] = [];
  const server = spawn("node", ["--experimental-webstorage", storage, "--disable-warning=ExperimentalWarning", entry], {
    cwd: app,
    env: { ...process.env, PORT: String(PORT), KEEL_SECRET: secret, KEEL_ORIGIN: ORIGIN },
  });
  server.stdout.on("data", (d) => log.push(...String(d).split("\n")));
  const problems: string[] = [];
  try {
    if (!(await listening(server))) return `server did not listen on ${ORIGIN}`;
    for (const [name, engine] of engines) {
      const browser = await engine.launch();
      try {
        for (const p of await journey(browser, organizer)) problems.push(`${name} ${p}`);
        for (const p of await contrast(browser, organizer, axe)) problems.push(`${name} ${p}`);
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

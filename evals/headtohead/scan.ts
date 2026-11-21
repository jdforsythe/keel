// The security scan and the a11y scan of the head-to-head: both run against one URL, so both arms are measured the same
// way. Each returns counts and one line per defect. Security reads response headers and policy over HTTP and probes one
// stored-XSS payload through the new-recipe form; a11y runs axe-core in Chromium over the pages.
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import { type Page, chromium } from "@playwright/test";

export type Defect = { id: string; detail: string };
export type Security = { defects: number; checks: number; found: Defect[] };
export type A11y = { defects: number; nodes: number; pages: number; found: Defect[] };

const STEP_MS = 6_000;
const PAGES = ["/", "/de-DE", "/recipes/new", "/catalog", "/ja-JP/recipes/new"] as const;
const XSS_TITLE = "<img src=x onerror=window.__keelXss=1>";

const lower = (h: Headers, name: string): string => (h.get(name) ?? "").toLowerCase();

/** Policy findings of one Content-Security-Policy value; an empty list is a sound policy. */
export function cspFindings(csp: string): string[] {
  if (csp === "") return ["no content-security-policy"];
  const found: string[] = [];
  const directive = (name: string): string | undefined =>
    csp
      .split(";")
      .map((d) => d.trim())
      .find((d) => d === name || d.startsWith(`${name} `));
  const script = directive("script-src") ?? directive("default-src") ?? "";
  if (script === "") found.push("csp sets neither script-src nor default-src");
  if (/'unsafe-inline'/.test(script)) found.push("csp script-src allows 'unsafe-inline'");
  if (/'unsafe-eval'/.test(script)) found.push("csp script-src allows 'unsafe-eval'");
  if (/(^|\s)(\*|https?:|data:)(\s|$)/.test(script)) found.push("csp script-src allows any origin or scheme");
  if (directive("frame-ancestors") === undefined) found.push("csp has no frame-ancestors");
  const objectSrc = directive("object-src") ?? directive("default-src") ?? "";
  if (!/'none'/.test(objectSrc)) found.push("csp does not block object-src");
  return found;
}

export async function securityScan(origin: string): Promise<Security> {
  const found: Defect[] = [];
  let checks = 0;
  const check = (ok: boolean, id: string, detail: string): void => {
    checks++;
    if (!ok) found.push({ id, detail });
  };
  for (const path of ["/", "/de-DE", "/recipes/new", "/catalog"]) {
    const res = await fetch(`${origin}${path}`, { redirect: "manual" });
    const h = res.headers;
    const csp = lower(h, "content-security-policy");
    const cspProblems = cspFindings(csp);
    check(cspProblems.length === 0, `csp ${path}`, cspProblems.join("; "));
    check(lower(h, "x-content-type-options") === "nosniff", `nosniff ${path}`, "x-content-type-options is not nosniff");
    check(
      lower(h, "x-frame-options") !== "" || /frame-ancestors/.test(csp),
      `framing ${path}`,
      "no x-frame-options and no frame-ancestors",
    );
    check(lower(h, "referrer-policy") !== "", `referrer ${path}`, "no referrer-policy");
    check(lower(h, "permissions-policy") !== "", `permissions ${path}`, "no permissions-policy");
    check(h.get("x-powered-by") === null, `x-powered-by ${path}`, `x-powered-by: ${h.get("x-powered-by") ?? ""}`);
    const server = h.get("server") ?? "";
    check(!/\d/.test(server), `server ${path}`, `server header names a version: ${server}`);
    check(lower(h, "access-control-allow-origin") !== "*", `cors ${path}`, "access-control-allow-origin is *");
    for (const cookie of h.getSetCookie()) {
      const c = cookie.toLowerCase();
      check(/;\s*httponly/.test(c), `cookie ${path}`, `cookie without HttpOnly: ${cookie.split("=")[0] ?? ""}`);
      check(
        /;\s*samesite=(lax|strict)/.test(c),
        `cookie ${path}`,
        `cookie without SameSite: ${cookie.split("=")[0] ?? ""}`,
      );
    }
  }
  // An unknown path must not leak a stack trace or the framework's error page.
  const missing = await fetch(`${origin}/nothing/here/${Date.now()}`);
  const body = await missing.text();
  check(!/\bat [\w.<>]+ \(.+:\d+:\d+\)|node_modules/.test(body), "error-page", "an unknown path answers a stack trace");

  // Stored XSS: a title holding markup must show as text and run nothing.
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    context.setDefaultTimeout(STEP_MS);
    const page = await context.newPage();
    await page.goto(`${origin}/recipes/new`);
    // An app without the form cannot be probed; the acceptance suite already counts that.
    if ((await page.locator('[id="recipes.draft:title"]').count()) === 0) {
      await context.close();
      return { defects: found.length, checks, found };
    }
    await page.locator('[id="recipes.draft:title"]').fill(XSS_TITLE);
    await page.locator('[id="recipes.draft:minutes"]').fill("5");
    await page.locator('[id="recipes.draft:price.amount"]').fill("1");
    await page.locator('[id="recipes.draft:price.currency"]').selectOption("EUR");
    await page.locator('[id="recipes.save"]').click();
    await page.waitForTimeout(1_000);
    for (const path of ["/", "/catalog"]) {
      await page.goto(`${origin}${path}`);
      await page.waitForTimeout(800);
      const ran = await page.evaluate(() => Reflect.get(globalThis, "__keelXss") === 1);
      check(!ran, `xss ${path}`, "a stored title ran script");
      const injected = await page.locator("img[src='x']").count();
      check(injected === 0, `xss-markup ${path}`, "a stored title became an element");
    }
    await context.close();
  } finally {
    await browser.close();
  }
  return { defects: found.length, checks, found };
}

type AxeNode = { target: unknown };
type AxeViolation = { id: string; impact: string | null; nodes: AxeNode[] };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

function violationsOf(raw: unknown): AxeViolation[] {
  const list = isRecord(raw) && Array.isArray(raw["violations"]) ? raw["violations"] : [];
  const out: AxeViolation[] = [];
  for (const v of list) {
    if (!isRecord(v) || typeof v["id"] !== "string") continue;
    out.push({
      id: v["id"],
      impact: typeof v["impact"] === "string" ? v["impact"] : null,
      nodes: Array.isArray(v["nodes"]) ? v["nodes"].filter(isRecord).map((n) => ({ target: n["target"] })) : [],
    });
  }
  return out;
}

async function axeOn(page: Page, source: string): Promise<AxeViolation[]> {
  await page.evaluate(source);
  const raw: unknown = await page.evaluate(async () => {
    const engine: unknown = Reflect.get(globalThis, "axe");
    if (typeof engine !== "object" || engine === null) return { violations: [] };
    const run = Reflect.get(engine, "run");
    if (typeof run !== "function") return { violations: [] };
    return Reflect.apply(run, engine, [document, { resultTypes: ["violations"] }]);
  });
  return violationsOf(raw);
}

/** axe-core's default rules on each page in a context that bypasses the page's policy. */
export async function a11yScan(origin: string, root: string): Promise<A11y> {
  const axePath = createRequire(join(root, "packages", "testing", "package.json")).resolve("axe-core/axe.min.js");
  const source = await readFile(axePath, "utf8");
  const found: Defect[] = [];
  let nodes = 0;
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ bypassCSP: true });
    context.setDefaultTimeout(STEP_MS);
    const page = await context.newPage();
    for (const path of PAGES) {
      await page.goto(`${origin}${path}`);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(500);
      for (const v of await axeOn(page, source)) {
        nodes += v.nodes.length;
        found.push({ id: `${v.id} ${path}`, detail: `${v.impact ?? "unrated"}, ${v.nodes.length} node(s)` });
      }
    }
    await context.close();
  } finally {
    await browser.close();
  }
  return { defects: found.length, nodes, pages: PAGES.length, found };
}

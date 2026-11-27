import type { Page as Tab } from "playwright-core";
import type { CookieSeed } from "../../types/CookieSeed.ts";
import type { Page } from "../../types/Page.ts";
import type { ContextRun } from "./ContextRun.ts";
import type { ProjectInfo } from "./ProjectInfo.ts";
import type { TabState } from "./TabState.ts";
import { boundMs } from "./boundMs.ts";
import { e2eError } from "./e2eError.ts";
import { engineOf } from "./engineOf.ts";
import { fileBrowser } from "./fileBrowser.ts";
import { makePage } from "./makePage.ts";
import { pageScript } from "./pageScript.ts";
import { quiet } from "./quiet.ts";
import { seconds } from "./seconds.ts";
import { trackTab } from "./trackTab.ts";
import { withoutScripts } from "./withoutScripts.ts";

/**
 * A new browser context of a serve (k.e2e-page open) through the serve's proxy, recording a trace from the start, and
 * its first tab at `path`: resolved once `load` has fired and the tab is quiet, or, held, once the document is parsed
 * with every script of the app parked. `scripts: false` turns scripts off for the context.
 */
export async function openContext(o: {
  readonly project: ProjectInfo;
  readonly origin: string;
  readonly path: string;
  readonly scripts: boolean;
  readonly hold: boolean;
  readonly cookies: readonly CookieSeed[];
  readonly proxy: string;
  readonly mapped: boolean;
  /** Whether the serve's proxy refused a request for `origin` (k.e2e-run Reach). */
  readonly refusedAt: (origin: string) => boolean;
  readonly verb: () => void;
  readonly failed: () => void;
  /** The serve's contexts: this one joins them before its first tab loads, so the test's end closes it. */
  readonly contexts: ContextRun[];
}): Promise<Page> {
  const browser = await fileBrowser();
  const context = await browser.newContext({
    serviceWorkers: "allow",
    ...(o.proxy === "" ? {} : { proxy: { server: o.proxy } }),
    // Chromium trusts the loopback certificate by its key (fileBrowser.ts); the other engines take no such list.
    ...(o.mapped && engineOf() !== "chromium" ? { ignoreHTTPSErrors: true } : {}),
  });
  await context.tracing.start({ screenshots: true, snapshots: true });
  if (o.cookies.length > 0)
    await context.addCookies(
      o.cookies.map((c) => ({
        name: c.name,
        value: c.value,
        url: c.origin,
        ...(c.sameSite === undefined ? {} : { sameSite: c.sameSite }),
        ...(c.secure === undefined ? {} : { secure: c.secure }),
        ...(c.httpOnly === undefined ? {} : { httpOnly: c.httpOnly }),
      })),
    );
  const run: ContextRun = { context, tabs: [] };
  o.contexts.push(run);
  await context.exposeBinding("__keelProblem", (source, kind: unknown, text: unknown) => {
    const tab = run.tabs.find((t) => t.tab === source.page);
    if (tab !== undefined && kind === "csp" && typeof text === "string") {
      tab.problems.push({ kind: "csp", text });
      for (const w of [...tab.waiters]) w();
    }
  });
  await context.addInitScript({ content: await pageScript() });
  // A tab the page opened by itself: tracked from its first event, loaded and quiet as `open` resolves.
  const adopted = new Map<Tab, Page>();
  const adopt = async (tab: Tab): Promise<Page> => {
    const known = adopted.get(tab);
    if (known !== undefined) return known;
    const state: TabState = trackTab(tab, false, o.refusedAt);
    run.tabs.push(state);
    const page = makePage(
      state,
      { project: o.project, origin: o.origin, run, verb: o.verb, failed: o.failed, adopt },
      (p, h) => tabAt(p, h),
    );
    adopted.set(tab, page);
    const ms = boundMs();
    const from = performance.now();
    try {
      await tab.waitForLoadState("load", { timeout: ms });
    } catch (e) {
      if (e instanceof Error && e.name === "TimeoutError")
        throw e2eError("E1735", `opened: the document did not load after ${seconds(ms)}`, {}, "k.e2e-page");
      throw e;
    }
    if (!(await quiet(state, from + ms)))
      throw e2eError("E1735", `opened: the page was not quiet after ${seconds(ms)}`, {}, "k.e2e-page");
    return page;
  };

  const tabAt = async (path: string, hold: boolean): Promise<Page> => {
    const tab = await context.newPage();
    const state: TabState = trackTab(tab, hold, o.refusedAt);
    run.tabs.push(state);
    // Scripts off: no script of the page reaches it, and each document arrives with its script elements taken out,
    // so the page script of this harness still reads the page.
    if (!o.scripts)
      await tab.route("**/*", async (route) => {
        const r = route.request();
        if (r.resourceType() === "script") return route.abort("blockedbyclient");
        if (r.resourceType() !== "document") return route.fallback();
        const answer = await route.fetch();
        const type = answer.headers()["content-type"] ?? "";
        if (!type.includes("text/html")) return route.fulfill({ response: answer });
        await route.fulfill({ response: answer, body: withoutScripts(await answer.text()) });
      });
    if (hold)
      await tab.route("**/*", async (route) => {
        if (state.holding && route.request().resourceType() === "script") {
          state.parked.push(route);
          for (const w of [...state.waiters]) w();
          return;
        }
        await route.fallback().catch(() => undefined);
      });
    const page = makePage(
      state,
      { project: o.project, origin: o.origin, run, verb: o.verb, failed: o.failed, adopt },
      (p, h) => tabAt(p, h),
    );
    const ms = boundMs();
    const from = performance.now();
    const url = new URL(path, o.origin).href;
    try {
      if (hold) {
        await tab.goto(url, { waitUntil: "commit", timeout: ms });
        await tab.waitForFunction(() => document.readyState !== "loading", undefined, {
          timeout: Math.max(1, from + ms - performance.now()),
        });
      } else await tab.goto(url, { waitUntil: "load", timeout: ms });
    } catch (e) {
      if (e instanceof Error && e.name === "TimeoutError")
        throw e2eError("E1735", `open ${path}: the document did not load after ${seconds(ms)}`, { path }, "k.e2e-page");
      throw e;
    }
    if (!(await quiet(state, from + ms)))
      throw e2eError("E1735", `open ${path}: the page was not quiet after ${seconds(ms)}`, { path }, "k.e2e-page");
    return page;
  };
  try {
    return await tabAt(o.path, o.hold);
  } catch (e) {
    o.failed();
    throw e;
  }
}

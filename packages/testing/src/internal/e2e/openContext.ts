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
  readonly proxy: string;
  readonly mapped: boolean;
  readonly verb: () => void;
  readonly failed: () => void;
  /** The serve's contexts: this one joins them before its first tab loads, so the test's end closes it. */
  readonly contexts: ContextRun[];
}): Promise<Page> {
  const browser = await fileBrowser();
  const context = await browser.newContext({
    javaScriptEnabled: o.scripts,
    serviceWorkers: "allow",
    ...(o.proxy === "" ? {} : { proxy: { server: o.proxy } }),
    // Chromium trusts the loopback certificate by its key (fileBrowser.ts); the other engines take no such list.
    ...(o.mapped && engineOf() !== "chromium" ? { ignoreHTTPSErrors: true } : {}),
  });
  await context.tracing.start({ screenshots: true, snapshots: true });
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

  const tabAt = async (path: string, hold: boolean): Promise<Page> => {
    const tab = await context.newPage();
    const state: TabState = trackTab(tab, hold);
    run.tabs.push(state);
    if (hold)
      await tab.route("**/*", async (route) => {
        if (state.holding && route.request().resourceType() === "script") {
          state.parked.push(route);
          for (const w of [...state.waiters]) w();
          return;
        }
        await route.continue().catch(() => undefined);
      });
    const page = makePage(state, { project: o.project, origin: o.origin, run, verb: o.verb, failed: o.failed }, (p) =>
      tabAt(p, false),
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

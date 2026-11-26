import type { Request, Page as Tab } from "playwright-core";
import type { TabState } from "./TabState.ts";
import { sentOf } from "./sentOf.ts";

/**
 * Starts tracking `tab` (k.e2e-page): its requests and their answers, the documents it loads, whether a navigation is
 * under way, and its problems (page errors, console errors; policy violations arrive through the context's binding).
 * Each change wakes the waits that watch the tab.
 */
export function trackTab(tab: Tab, holding: boolean): TabState {
  const state: TabState = {
    tab,
    problems: [],
    requests: [],
    documents: [],
    inflight: new Set(),
    parked: [],
    holding,
    loaded: false,
    waiters: new Set(),
  };
  const wake = (): void => {
    for (const w of [...state.waiters]) w();
  };
  const main = (r: Request): boolean => r.isNavigationRequest() && r.frame() === tab.mainFrame();
  tab.on("request", (r) => {
    state.requests.push(sentOf(r.method(), r.url(), Object.keys(r.headers())));
    state.inflight.add(r);
    if (main(r)) state.loaded = false;
    wake();
  });
  tab.on("response", (res) => {
    const r = res.request();
    // An event stream is answered by its headers; any other request once its body has arrived (requestfinished).
    if ((res.headers()["content-type"] ?? "").includes("text/event-stream")) state.inflight.delete(r);
    if (main(r)) state.documents.push({ method: r.method(), url: r.url(), status: res.status() });
    wake();
  });
  const done = (r: Request): void => {
    state.inflight.delete(r);
    wake();
  };
  tab.on("requestfinished", done);
  tab.on("requestfailed", done);
  tab.on("load", () => {
    state.loaded = true;
    wake();
  });
  tab.on("pageerror", (e) => {
    state.problems.push({ kind: "pageerror", text: `${e.name}: ${e.message}` });
    wake();
  });
  tab.on("console", (m) => {
    const type = m.type();
    if (type !== "error" && type !== "warning") return;
    state.problems.push({ kind: type === "error" ? "console" : "warning", text: m.text() });
    wake();
  });
  return state;
}

import { type Ctx, createCtx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import type { RouteTable } from "@keel/router";
import { compileRoutes } from "@keel/router/internal";
import { matchHref } from "@keel/router/match";
import { resume } from "@keel/runtime-dom/ops";
import type { Island } from "@keel/runtime-dom/ops";
import { stores } from "@keel/store";
import type { DocumentApp } from "../types/DocumentApp.ts";
import type { DocumentNavigation } from "../types/DocumentNavigation.ts";
import type { RouteHarness } from "../types/RouteHarness.ts";
import type { RouteRenderOptions } from "../types/RouteRenderOptions.ts";
import type { RouteStateOf } from "../types/RouteStateOf.ts";
import { clockStep } from "./clockStep.ts";
import { fail } from "./fail.ts";
import { openHarness } from "./openHarness.ts";
import { seedFrom } from "./seedFrom.ts";
import { settle } from "./settle.ts";

/** Redirects followed for one navigation before it fails, as a browser caps a chain. */
const MAX_REDIRECTS = 20;
const REDIRECT: ReadonlySet<number> = new Set([301, 302, 303, 307, 308]);

/** The route state of the page at `path`: its match in `routes`, never pending (a document is loaded whole). */
function stateAt(routes: RouteTable, path: string): unknown {
  const m = matchHref(routes, path);
  return m === null
    ? { id: null, params: {}, search: {}, pending: false }
    : { id: m.id, params: m.params, search: m.search, pending: false };
}

/** Narrow a route state built by `stateAt` from a match in `routes` to the table's typed state. */
function isStateOf<T extends RouteTable>(routes: T, x: unknown): x is RouteStateOf<T> {
  if (typeof x !== "object" || x === null || !("id" in x)) return false;
  return x.id === null || (typeof x.id === "string" && compileRoutes(routes).table.has(x.id));
}

/** The `name=value` pairs of a response's `Set-Cookie` lines. */
function setCookies(res: Response): [string, string][] {
  const raw = res.headers.get("set-cookie");
  if (raw === null) return [];
  return raw
    .split(/,(?=\s*[^;,=\s]+=)/)
    .map((line) => (line.split(";")[0] ?? "").trim())
    .filter((pair) => pair.includes("="))
    .map((pair) => {
      const at = pair.indexOf("=");
      return [pair.slice(0, at), pair.slice(at + 1)];
    });
}

/**
 * `renderRoute(id, { app })` (k.testing Harness): page `id` at `url` runs as a built `node` page runs, with no router.
 * The harness GETs `url` from `app`, follows redirects with a GET, and resumes the answer's body (scripts dropped but
 * `#k-state`) on `ctx` with every live store, as `resumeDocument` does, except that an island that mismatches
 * re-renders on the client as in a browser (E1720 for any other warning); the document's title and `lang` are the
 * page's until `dispose`. Each document navigation the page starts is recorded in `documents()` and, when it is a path
 * of the page's origin, made: a form post is POSTed urlencoded with `sec-fetch-site: same-origin`, the answer (a 422
 * too) replaces the page and is resumed before `fire` resolves. The harness keeps the cookies `app` sets and sends
 * them back, as a browser does. `navigate(href)` loads `href` the same way; `location().entries` counts the loaded
 * documents and `route()` is the match of the last one. `state` or `shell` reject with E1722 before any request.
 */
export async function documentRoute<T extends RouteTable>(
  id: string,
  url: string,
  options: RouteRenderOptions<T>,
  app: DocumentApp,
): Promise<RouteHarness<RouteStateOf<T>, Ctx>> {
  if (options.state !== undefined || options.shell !== undefined)
    throw fail(
      "E1722",
      `renderRoute(${JSON.stringify(id)}): app serves the page, so ${options.state !== undefined ? "state" : "shell"} has no meaning; seed ctx.storage`,
      { option: options.state !== undefined ? "state" : "shell" },
    );
  const routes: RouteTable = options.routes;
  const ctx = options.ctx ?? createCtx({ mode: "sim", seed: seedFrom(undefined) });
  const origin = /^https?:$/.test(location.protocol) ? location.origin : "http://localhost";
  const components: Record<string, Island> = {};
  for (const [rid, { def }] of compileRoutes(routes).table) if (def.component) components[rid] = def.component;
  const jar = new Map<string, string>();
  const cookie = (): string => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");

  /** Request `path` from `app`, following redirects; the final path and its answer's text, or null off `app`. */
  const request = async (
    method: string,
    path: string,
    body: string | null,
  ): Promise<{ path: string; html: string } | null> => {
    let at = path;
    let verb = method;
    let sent = body;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const headers = new Headers({ accept: "text/html", "sec-fetch-site": "same-origin" });
      const jarred = cookie();
      if (jarred !== "") headers.set("cookie", jarred);
      if (sent !== null) headers.set("content-type", "application/x-www-form-urlencoded");
      const res = await app.fetch(
        new Request(
          `${origin}${at}`,
          sent === null ? { method: verb, headers } : { method: verb, headers, body: sent },
        ),
      );
      for (const [k, v] of setCookies(res)) jar.set(k, v);
      const to = REDIRECT.has(res.status) ? res.headers.get("location") : null;
      if (to === null) return { path: at, html: await res.text() };
      const next = new URL(to, `${origin}${at}`);
      if (next.origin !== origin) return null;
      at = `${next.pathname}${next.search}`;
      if (res.status === 303 || verb !== "GET") {
        verb = "GET";
        sent = null;
      }
    }
    throw fail(
      "keel.unexpected",
      `renderRoute(${JSON.stringify(id)}): more than ${MAX_REDIRECTS} redirects from ${path}`,
      {
        url: path,
      },
    );
  };

  const first = await request("GET", url, null);
  if (first === null)
    throw fail("E1501", `renderRoute(${JSON.stringify(id)}): app redirected ${url} off its origin`, { url });
  const head = { title: document.title, lang: document.documentElement.getAttribute("lang") };
  let current = first.path;
  let loads = 1;
  let islands: { dispose: () => void } = { dispose: () => undefined };
  let host: HTMLElement | undefined;
  const warnings: string[] = [];

  /** Put the document `html` in the container and resume its islands, after disposing the last page's. */
  const show = (html: string): void => {
    if (host === undefined) return;
    islands.dispose();
    const doc = new DOMParser().parseFromString(html, "text/html");
    for (const s of doc.body.querySelectorAll("script:not(#k-state)")) s.remove();
    document.title = doc.title === "" ? id : doc.title;
    const lang = doc.documentElement.getAttribute("lang");
    if (lang !== null) document.documentElement.setAttribute("lang", lang);
    host.replaceChildren(...doc.body.childNodes);
    const at = host;
    islands = scope(() => {
      const { warnings: said } = resume(at, components, { ctx, stores: Object.fromEntries(stores()) });
      // An island that mismatches re-renders on the client, as the resume entry does in a browser; the rest reject.
      warnings.push(...said.filter((w) => !w.includes("re-rendered on the client")));
    });
  };

  let pending = 0;
  const failures: unknown[] = [];
  const documents: DocumentNavigation[] = [];
  /** Make navigation `nav` when it is a path of the page's origin (the rest stay recorded only). */
  const follow = (nav: DocumentNavigation): void => {
    if (!nav.url.startsWith("/") || nav.url.startsWith("//")) return;
    pending++;
    void request(nav.method, nav.url, nav.body)
      .then((got) => {
        if (got === null) return;
        current = got.path;
        loads++;
        show(got.html);
      })
      .catch((e: unknown) => void failures.push(e))
      .finally(() => {
        pending--;
      });
  };
  const busy = (): string | null => (pending > 0 ? current : null);
  const raise = (): void => {
    const [w] = warnings.splice(0);
    if (w !== undefined) throw fail("E1720", `the document did not resume: ${w}`, { warnings: [w] });
    const [e] = failures.splice(0);
    if (e !== undefined) throw e;
  };

  const { harness, check } = openHarness({
    start: (container) => {
      host = container;
      show(first.html);
    },
    ctx,
    seeded: [],
    busy,
    documents,
    follow,
    page: true,
    target: () => ({ route: current, component: null }),
    teardown: () => {
      islands.dispose();
      document.title = head.title;
      if (head.lang === null) document.documentElement.removeAttribute("lang");
      else document.documentElement.setAttribute("lang", head.lang);
    },
    artifacts: options.artifacts,
  });
  try {
    raise();
    await settle(document.body, () => undefined, busy, undefined, clockStep(ctx));
    raise();
    check();
  } catch (error) {
    harness.dispose();
    throw error;
  }
  const route = (): RouteStateOf<T> => {
    const st = stateAt(routes, current);
    if (!isStateOf(options.routes, st))
      throw fail("E1501", `renderRoute: ${current} is no page of routes`, { url: current });
    return st;
  };
  return {
    ...harness,
    fire: async (target, event) => {
      await harness.fire(target, event);
      raise();
    },
    settle: async () => {
      await harness.settle();
      raise();
    },
    route,
    navigate: async (href) => {
      const nav = { method: "GET", url: href, body: null };
      documents.push(nav);
      follow(nav);
      await harness.settle();
      raise();
    },
    location: () => ({ entries: loads, scrollY: window.scrollY }),
    documents: () => [...documents],
    returnLink: async () => undefined,
    launch: async () => undefined,
  };
}

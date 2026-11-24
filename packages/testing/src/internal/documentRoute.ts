import { type Ctx, type Net, createCtx } from "@keel/ctx";
import { browserCtx, holdOn } from "@keel/ctx/internal";
import { scope } from "@keel/reactive";
import type { RouteTable } from "@keel/router";
import { compileRoutes, encodeHref } from "@keel/router/internal";
import { matchHref } from "@keel/router/match";
import { resume } from "@keel/runtime-dom/ops";
import type { Island } from "@keel/runtime-dom/ops";
import { stores } from "@keel/store";
import type { DocumentApp } from "../types/DocumentApp.ts";
import type { DocumentNavigation } from "../types/DocumentNavigation.ts";
import type { RouteHarness } from "../types/RouteHarness.ts";
import type { RouteRenderOptions } from "../types/RouteRenderOptions.ts";
import type { RouteStateOf } from "../types/RouteStateOf.ts";
import { appSigner } from "./appSigner.ts";
import { browserFront } from "./browserFront.ts";
import { fail } from "./fail.ts";
import { freshGraph } from "./freshGraph.ts";
import { openHarness } from "./openHarness.ts";
import { requestLog } from "./requestLog.ts";
import { seedFrom } from "./seedFrom.ts";
import { settle } from "./settle.ts";
import { watchOf } from "./watchOf.ts";

/** Redirects followed for one navigation before it fails, as a browser caps a chain. */
const MAX_REDIRECTS = 20;
const REDIRECT: ReadonlySet<number> = new Set([301, 302, 303, 307, 308]);

/** The route state of the page at `path`: its match in `routes`, never pending (a document is loaded whole). */
function stateAt(graph: Graph, routes: RouteTable, path: string): unknown {
  const m = graph.matchHref(routes, path);
  return m === null
    ? { id: null, params: {}, search: {}, pending: false }
    : { id: m.id, params: m.params, search: m.search, pending: false };
}

/** Narrow a route state built by `stateAt` from a match in `routes` to the table's typed state. */
function isStateOf<T extends RouteTable>(graph: Graph, routes: RouteTable, x: unknown): x is RouteStateOf<T> {
  if (typeof x !== "object" || x === null || !("id" in x)) return false;
  return x.id === null || (typeof x.id === "string" && graph.compileRoutes(routes).table.has(x.id));
}

/** The client module graph a page resumes in: the test's own, or one `freshGraph` evaluated for this harness. */
type Graph = Awaited<ReturnType<typeof freshGraph>>;

/** Nets whose origin `routeOrigin` routed, per app: one route each, so a later harness adds none. */
const routed = new WeakMap<Net, Set<string>>();

/**
 * Route `origin` on a sim `net` to `app.fetch`, once per net and origin. A sim net takes its first matching route, so
 * a route the test made first keeps the origin. A net with no routes is left alone (the front then sends to `app`).
 */
function routeOrigin(net: Net, origin: string, app: DocumentApp): void {
  if (!("route" in net) || typeof net.route !== "function") return;
  const done = routed.get(net) ?? new Set<string>();
  routed.set(net, done);
  if (done.has(origin)) return;
  done.add(origin);
  Reflect.apply(net.route, net, [`${origin}/*`, (req: Request) => app.fetch(req)]);
}

/**
 * `renderRoute(id, { app })` (k.testing Harness): page `id` at `url` runs as a built `node` page runs, with no router.
 * The harness GETs `url` from `app`, follows redirects with a GET, and resumes the answer's body (scripts dropped but
 * `#k-state`) on `ctx` with every live store, as `resumeDocument` does: any resume warning, an island that mismatches
 * its server markup too, rejects with E1720. The document's title and `lang` are the page's until `dispose`. Each
 * document navigation the page starts is recorded in `documents()` and, when it is a path of the page's origin, made:
 * a form post is POSTed urlencoded with `sec-fetch-site: same-origin`, the answer (a 422 too) replaces the page and is
 * resumed before `fire` resolves. The harness is one browser (k.mount Testing): the page runs on a ctx of its own
 * (`ctx`'s clock and random, a fresh storage) whose net is the harness's front (`browserFront`), and every request to
 * the origin, the document loads included, goes through it to `ctx.net`, which routes the origin to `app.fetch` unless
 * the test routed it first. The front's jar keeps the cookies `app` sets, so `caller` is one `app` mints and a
 * sign-in through the mount holds; with `user` each such request carries `x-keel-user` for it (`appSigner`, E1724
 * when `ctx`'s binding does not hold `app`). With `routes` as an import (`RoutesImport`) the page resumes in a client
 * module graph of its own (`freshGraph`): its client stores, widget stores and islands are this harness's alone, and
 * `state()` and `settle` read that graph's stores. `navigate(href)` loads `href` the same way; `location().entries` counts the loaded
 * documents and `route()` is the match of the last one. `state`, `shell` or `mount` reject with E1722 before any request.
 */
export async function documentRoute<T extends RouteTable>(
  id: string,
  options: RouteRenderOptions<T>,
  app: DocumentApp,
): Promise<RouteHarness<RouteStateOf<T>, Ctx>> {
  const stray =
    options.state !== undefined
      ? "state"
      : options.shell !== undefined
        ? "shell"
        : options.mount !== undefined
          ? "mount"
          : null;
  if (stray !== null)
    throw fail(
      "E1722",
      stray === "mount"
        ? `renderRoute(${JSON.stringify(id)}): app serves the page and gives its identity, so mount has no meaning; drop mount`
        : `renderRoute(${JSON.stringify(id)}): app serves the page, so ${stray} has no meaning; seed ctx.storage`,
      { option: stray },
    );
  const given = options.routes;
  const ctx = options.ctx ?? createCtx({ mode: "sim", seed: seedFrom(undefined) });
  // An import resumes the page in a client module graph of its own: this harness's browser alone. The test runner
  // answers the import over a channel made before the run, so the load is held, under the route id (k.drive Seams).
  const graph =
    typeof given === "function"
      ? await holdOn(ctx.clock)(id, () => freshGraph(given))
      : {
          routes: given,
          table: compileRoutes(given).table,
          compileRoutes,
          matchHref,
          encodeHref,
          resume,
          stores,
          scope,
        };
  const routes: RouteTable = graph.routes;
  const raw = options.url;
  // A raw url is a root-relative path and query of page `id` (never another origin, scheme or route).
  if (raw !== undefined && (!/^\/(?![/\\])/.test(raw) || graph.matchHref(routes, raw)?.id !== id))
    throw fail("E1501", `renderRoute(${JSON.stringify(id)}): url ${JSON.stringify(raw)} is not a path of this page`, {
      url: raw,
    });
  const url = raw ?? graph.encodeHref(id, graph.table.get(id)?.def, options.params ?? {}, options.search ?? {});
  // Each harness starts at the top: scroll is the window's, shared with the test before.
  window.scrollTo(0, 0);
  const origin = /^https?:$/.test(location.protocol) ? location.origin : "http://localhost";
  const components: Record<string, Island> = {};
  for (const [rid, { def }] of graph.table) if (def.component) components[rid] = def.component;
  const sign = options.user === undefined ? undefined : appSigner(ctx, app, id, options.user);
  routeOrigin(ctx.net, origin, app);
  const log = requestLog();
  const front = browserFront({
    log: log.push,
    origin,
    net: ctx.net,
    send: "route" in ctx.net ? (req) => ctx.net.fetch(req) : (req) => app.fetch(req),
    clock: ctx.clock,
    sign,
  });
  const page = browserCtx(ctx, { net: front });

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
      if (sent !== null) headers.set("content-type", "application/x-www-form-urlencoded");
      const res = await front.fetch(
        new Request(
          `${origin}${at}`,
          sent === null
            ? { method: verb, headers, redirect: "manual" }
            : { method: verb, headers, body: sent, redirect: "manual" },
        ),
      );
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
    islands = graph.scope(() => {
      const { warnings: said } = graph.resume(at, components, {
        ctx: page,
        stores: Object.fromEntries(graph.stores()),
      });
      // A mismatch the browser would paper over with a client re-render is a fault the test reports.
      warnings.push(...said);
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
    run: page,
    seeded: [],
    registry: graph.stores,
    log,
    busy,
    documents,
    follow,
    page: true,
    // The page's route id, as router mode records it, so its a11y report rows key the ledger alike.
    target: () => ({ route: String(graph.matchHref(routes, current)?.id ?? current), component: null }),
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
    await settle(document.body, () => undefined, busy, undefined, watchOf(ctx));
    raise();
    check();
  } catch (error) {
    harness.dispose();
    throw error;
  }
  const route = (): RouteStateOf<T> => {
    const st = stateAt(graph, routes, current);
    if (!isStateOf<T>(graph, routes, st))
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

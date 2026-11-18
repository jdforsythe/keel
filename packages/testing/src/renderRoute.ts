import { createCtx } from "@keel/ctx";
import type { Manifest, RouteDef, RouteState, Router } from "@keel/router";
import { createRouterWith } from "@keel/router/internal";
import { matchHref } from "@keel/router/match";
import { serverState } from "@keel/store/internal";
import { fail } from "./internal/fail.ts";
import { memoryHistory } from "./internal/memoryHistory.ts";
import { openHarness } from "./internal/openHarness.ts";
import { seedFrom } from "./internal/seedFrom.ts";
import { seedStores } from "./internal/seedStores.ts";
import { settle } from "./internal/settle.ts";
import type { RouteHarness } from "./types/RouteHarness.ts";
import type { RouteRenderOptions } from "./types/RouteRenderOptions.ts";

/**
 * Render page `id` of `options.routes` (an API route has no view: its id rejects) (k.testing Harness): seed `state`,
 * create a router on an in-memory history at `url` (a root-relative path and query matching page `id`, else E1501),
 * else `routes.href(id, params, search)`; scroll goes to the top at open and at dispose (its initial navigation runs the
 * chain's guards and loaders), mount its `App`, and resolve once no navigation is pending and the DOM is quiet; then
 * the render checks run (`keel.unexpected`, then k.a11y's: E1702, E1703 with the document rules, E1804, E1821). The
 * page is a document: the chain is its `main` landmark unless it renders one, the router writes `<title>` and
 * `<html lang>` (k.head), and a document without a title takes the route id as the server's fallback title. The
 * handle is `render`'s plus `route()`, `navigate(href)` (push, then the same quiescence and checks as `fire`) and
 * `location()` (`{ entries, scrollY }`: the history length and the scroll position);
 * `dispose` also disposes the router and puts the title and `lang` back. Guards, loaders and actions get
 * `options.caller` and `options.user` (each default `""`). Loaders and actions naming `stores` run their factories over `ctx.storage` as a
 * `node` deployable does (`serverState`, k.server Server state), each navigation or submit one request; `state` and
 * `state()` hold no factory store.
 */
export async function renderRoute<M extends Readonly<Record<string, RouteDef>>>(
  id: string,
  options: RouteRenderOptions<M>,
): Promise<RouteHarness<RouteState<M>>> {
  const routes: Manifest<Readonly<Record<string, RouteDef>>> = options.routes;
  const raw = options.url;
  // A raw url is a root-relative path and query of page `id` (never another origin, scheme or route).
  if (raw !== undefined && (!/^\/(?![/\\])/.test(raw) || matchHref(routes, raw)?.id !== id))
    throw fail("E1501", `renderRoute(${JSON.stringify(id)}): url ${JSON.stringify(raw)} is not a path of this page`, {
      url: raw,
    });
  const url = raw ?? routes.href(id, options.params ?? {}, options.search ?? {});
  // Each harness starts at the top: scroll is the window's, shared with the test before.
  window.scrollTo(0, 0);
  const seeded = seedStores(options.state ?? []);
  // The document a server writes always has a title (the deployable's name, k.head); the harness's fallback is the id.
  const head = { title: document.title, lang: document.documentElement.getAttribute("lang") };
  if (document.title === "") document.title = id;
  const restoreHead = (): void => {
    document.title = head.title;
    if (head.lang === null) document.documentElement.removeAttribute("lang");
    else document.documentElement.setAttribute("lang", head.lang);
  };
  const ctx = options.ctx ?? createCtx({ mode: "sim", seed: seedFrom(undefined) });
  let router: Router<RouteState<M>>;
  const history = memoryHistory(url);
  try {
    router = createRouterWith(
      options.routes,
      { ctx, history, caller: options.caller ?? "", user: options.user ?? "" },
      serverState(ctx),
    );
  } catch (error) {
    for (const [st, snap] of seeded) st.restore(snap);
    restoreHead();
    throw error;
  }
  const busy = (): string | null => {
    const r = router.route.get();
    return r.pending ? String(r.id) : null;
  };
  const a11y = options.artifacts?.["a11y.json"];
  const tokens = options.artifacts?.tokens;
  const { harness, check } = openHarness({
    view: () => router.App(),
    ctx,
    seeded,
    busy,
    page: true,
    target: () => ({ route: String(router.route.get().id), component: null }),
    teardown: () => {
      router.dispose();
      restoreHead();
      window.scrollTo(0, 0);
    },
    ...(a11y === undefined ? {} : { a11y }),
    ...(tokens === undefined ? {} : { tokens }),
  });
  try {
    await settle(document.body, () => undefined, busy);
    check();
  } catch (error) {
    harness.dispose();
    throw error;
  }
  return {
    ...harness,
    route: () => router.route.get(),
    navigate: async (href) => {
      void router.navigate(href);
      await harness.settle();
    },
    location: () => ({ entries: history.length(), scrollY: window.scrollY }),
  };
}

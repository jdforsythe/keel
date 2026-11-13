import { createCtx } from "@keel/ctx";
import { createRouter } from "@keel/router";
import type { Manifest, RouteDef, RouteState } from "@keel/router";
import { memoryHistory } from "./internal/memoryHistory.ts";
import { openHarness } from "./internal/openHarness.ts";
import { seedFrom } from "./internal/seedFrom.ts";
import { seedStores } from "./internal/seedStores.ts";
import { settle } from "./internal/settle.ts";
import type { RouteHarness } from "./types/RouteHarness.ts";
import type { RouteRenderOptions } from "./types/RouteRenderOptions.ts";

/**
 * Render page `id` of `options.routes` (an API route has no view: its id rejects) (k.testing Harness): seed `state`, create a router on an in-memory history
 * at `routes.href(id, params, search)` (its initial navigation runs the chain's guards and loaders), mount its `App`, and
 * resolve once no navigation is pending and the DOM is quiet; then the `render` checks run (`keel.unexpected`,
 * then k.a11y's: E1702, E1703 with the document rules, E1804, E1821). The page is a document: the chain renders
 * inside `main`, the router writes `<title>` and `<html lang>` (k.head), and a document without a title takes the
 * route id as the server's fallback title; `dispose` puts the title and `lang` back. The handle is `render`'s plus `route()` and `navigate(href)` (push, then the same
 * quiescence and checks as `fire`; rfc:0070); `dispose` also disposes the router. Guards, loaders and actions get
 * `options.caller` (default `""`).
 */
export async function renderRoute<M extends Readonly<Record<string, RouteDef>>>(
  id: string,
  options: RouteRenderOptions<M>,
): Promise<RouteHarness<RouteState<M>>> {
  const routes: Manifest<Readonly<Record<string, RouteDef>>> = options.routes;
  const url = routes.href(id, options.params ?? {}, options.search ?? {});
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
  let router: ReturnType<typeof createRouter<M>>;
  try {
    router = createRouter(options.routes, { ctx, history: memoryHistory(url), caller: options.caller ?? "" });
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
  };
}

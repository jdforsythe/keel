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
 * E1702 with `artifacts`, E1703). The handle is `render`'s plus `route()` and `navigate(href)` (push, then the same
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
  const ctx = options.ctx ?? createCtx({ mode: "sim", seed: seedFrom(undefined) });
  let router: ReturnType<typeof createRouter<M>>;
  try {
    router = createRouter(options.routes, { ctx, history: memoryHistory(url), caller: options.caller ?? "" });
  } catch (error) {
    for (const [st, snap] of seeded) st.restore(snap);
    throw error;
  }
  const busy = (): string | null => {
    const r = router.route.get();
    return r.pending ? String(r.id) : null;
  };
  const a11y = options.artifacts?.["a11y.json"];
  const { harness, check } = openHarness({
    view: () => router.App(),
    ctx,
    seeded,
    busy,
    teardown: () => router.dispose(),
    ...(a11y === undefined ? {} : { a11y }),
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

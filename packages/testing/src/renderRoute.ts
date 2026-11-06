import { createCtx } from "@keel/ctx";
import { createRouter, href } from "@keel/router";
import type { RouteDef, RouteState } from "@keel/router";
import { memoryHistory } from "./internal/memoryHistory.ts";
import { openHarness } from "./internal/openHarness.ts";
import { seedFrom } from "./internal/seedFrom.ts";
import { seedStores } from "./internal/seedStores.ts";
import { settle } from "./internal/settle.ts";
import type { RouteHarness } from "./types/RouteHarness.ts";
import type { RouteRenderOptions } from "./types/RouteRenderOptions.ts";

/**
 * Render route `id` of `options.routes` (k.testing Harness): seed `state`, create a router on an in-memory history
 * at `href(id, params, search)` (its initial navigation runs the chain's guards and loaders), mount its `App`, and
 * resolve once no navigation is pending and the DOM is quiet; then the `render` checks run (`keel.unexpected`,
 * E1702 with `artifacts`, E1703). The handle is `render`'s plus `route()`; `dispose` also disposes the router.
 */
export async function renderRoute<M extends Readonly<Record<string, RouteDef>>>(
  id: string,
  options: RouteRenderOptions<M>,
): Promise<RouteHarness<RouteState<M>>> {
  const url = href(id, options.params ?? {}, options.search ?? {});
  const seeded = seedStores(options.state ?? []);
  const ctx = options.ctx ?? createCtx({ mode: "sim", seed: seedFrom(undefined) });
  let router: ReturnType<typeof createRouter<M>>;
  try {
    router = createRouter(options.routes, { ctx, history: memoryHistory(url) });
  } catch (error) {
    for (const [st, snap] of seeded) st.restore(snap);
    throw error;
  }
  const busy = (): boolean => router.route.get().pending;
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
  return { ...harness, route: () => router.route.get() };
}

import { report } from "@keel/ctx/internal";
import { eventQueue } from "../internal/eventQueue.ts";
import { islandProps } from "../internal/islandProps.ts";
import { readState } from "../internal/readState.ts";
import { resumeIsland } from "../internal/resumeIsland.ts";
import type { Island } from "../types/Island.ts";
import type { ResumeOptions } from "../types/ResumeOptions.ts";

// The package's one import-time effect: queue events fired before resume (see README).
eventQueue.install();

/**
 * Resume server-rendered islands under `root` (generated entry only, ADR-0006): restore `options.stores`
 * from `#k-state`, report its served `route` to `options.ctx`'s observers as a `nav`, then its failed loader's `error`
 * (`code` and `data.at` only), pass `options.ctx` (k.ctx) to every island root, then for each outermost `[data-k-island]` attach its bindings and delegated handlers to the
 * existing nodes without re-rendering, and replay events queued before resume. Each island has the root Boundary
 * `mount` gives its tree; its fallback shows the message only with `options.mode` `"dev"`. Returns dev warnings
 * (E1253: that island was re-rendered on the client).
 */
export function resume(
  root: Element,
  components: Readonly<Record<string, Island>>,
  options: ResumeOptions = {},
): { warnings: string[] } {
  const stores = options.stores ?? {};
  const warnings: string[] = [];
  const state = readState(root, warnings);
  for (const [id, snapshot] of Object.entries(state.stores)) {
    const store = Object.hasOwn(stores, id) ? stores[id] : undefined;
    if (store === undefined) warnings.push(`E1253 #k-state has a snapshot for unknown store "${id}"`);
    else store.restore(snapshot);
  }
  // The served route is the ctx's first navigation (k.ctx Observers, rfc:0071): no router runs on an island page.
  const route = state.route;
  if (route !== null) {
    const { href, ...rest } = route;
    report(options.ctx, { kind: "nav", href, route: { ...rest, schemas: {} } });
  }
  // The served page's failed loader ran on the server: report it here, after its route, so the ctx keeps it.
  if (state.error !== null) report(options.ctx, { kind: "error", error: state.error });
  const all = [...(root.matches("[data-k-island]") ? [root] : []), ...root.querySelectorAll("[data-k-island]")];
  const top = all.filter((el) => {
    const up = el.parentElement?.closest("[data-k-island]");
    return up === null || up === undefined || !all.includes(up);
  });
  let thrown: { error: unknown } | null = null;
  for (const el of top) {
    const id = el.getAttribute("data-k-island") ?? "";
    const component = Object.hasOwn(components, id) ? components[id] : undefined;
    if (component === undefined) {
      warnings.push(`E1253 [data-k-island="${id}"] has no compiled component; left static`);
      eventQueue.resume(el, null);
      continue;
    }
    try {
      const w = resumeIsland(
        el,
        id,
        component,
        islandProps(component, state.islands[id], id, warnings),
        options.ctx,
        options.mode,
      );
      if (w !== null) warnings.push(w);
    } catch (error) {
      thrown ??= { error };
    }
  }
  if (thrown !== null) throw thrown.error;
  return { warnings };
}

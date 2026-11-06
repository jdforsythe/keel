import { eventQueue } from "../internal/eventQueue.ts";
import { islandProps } from "../internal/islandProps.ts";
import { readState } from "../internal/readState.ts";
import { resumeIsland } from "../internal/resumeIsland.ts";
import type { Island } from "../types/Island.ts";
import type { Restorable } from "../types/Restorable.ts";

// The package's one import-time effect: queue events fired before resume (see README).
eventQueue.install();

/**
 * Resume server-rendered islands under `root` (generated entry only, ADR-0006): restore `stores` from
 * `#k-state`, then for each outermost `[data-k-island]` attach its bindings and delegated handlers to the
 * existing nodes without re-rendering, and replay events queued before resume. Returns dev warnings
 * (E1253: that island was re-rendered on the client).
 */
export function resume(
  root: Element,
  components: Readonly<Record<string, Island>>,
  stores: Readonly<Record<string, Restorable>> = {},
): { warnings: string[] } {
  const warnings: string[] = [];
  const state = readState(root, warnings);
  for (const [id, snapshot] of Object.entries(state.stores)) {
    const store = Object.hasOwn(stores, id) ? stores[id] : undefined;
    if (store === undefined) warnings.push(`E1253 #k-state has a snapshot for unknown store "${id}"`);
    else store.restore(snapshot);
  }
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
      continue;
    }
    try {
      const w = resumeIsland(el, id, component, islandProps(component, state.islands[id], id, warnings));
      if (w !== null) warnings.push(w);
    } catch (error) {
      thrown ??= { error };
    }
  }
  if (thrown !== null) throw thrown.error;
  return { warnings };
}

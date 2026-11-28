import { carriedIds } from "./carriedIds.ts";
import { registries } from "./registries.ts";

/**
 * Mark every store of the module registry as carried over (k.data Dev). The `keel dev` server module calls it each time
 * it is evaluated, before it loads the app's modules: a module evaluated again creates its store in place of the
 * carried one, a module left as it was keeps its store, and two stores of one id within one load still throw.
 */
export function storesReload(): void {
  carriedIds.clear();
  for (const id of registries.shared.keys()) carriedIds.add(id);
}

import { devLoad } from "./devLoad.ts";
import { registries } from "./registries.ts";

/**
 * Start a `keel dev` load of the module registry (k.data Dev): every store it holds joins the carried set, which
 * `storesLoaded` empties, and from now on each store created records the file `storesFile` last named. The dev server module calls it at its start,
 * before it loads the app's modules; a store created at the file of a carried store of its id then takes the id,
 * once, and any other store of a live id still throws.
 */
export function storesReload(): void {
  devLoad.armed = true;
  devLoad.file = undefined;
  for (const [id, held] of registries.shared) devLoad.carried.set(id, held);
}

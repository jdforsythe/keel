import type { Scope } from "@keel/reactive";
import type { Store } from "../types/Store.ts";

/**
 * The `keel dev` load of the module registry (k.data Dev), written only through `storesReload`, `storesFile` and
 * `storesLoaded`, which the dev server module alone calls. `armed` is set by the first `storesReload`: until then
 * no store records a file, so a build and a process the dev server module did not start never do. `file` is the app
 * file whose top level last began to run; `carried` the earlier load's stores by id; `origins` the file and owning
 * scope each store was created at while armed.
 */
export const devLoad: {
  armed: boolean;
  file: string | undefined;
  readonly carried: Map<string, Store<unknown>>;
  readonly origins: WeakMap<Store<unknown>, { readonly file: string | undefined; readonly scope: Scope | undefined }>;
} = { armed: false, file: undefined, carried: new Map(), origins: new WeakMap() };

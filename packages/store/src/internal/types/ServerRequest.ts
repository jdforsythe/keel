import type { Factory } from "./Factory.ts";
import type { SaveConflict } from "./SaveConflict.ts";

/**
 * One request over server state (`serverState`): `stores(factory)` is the request's instance of `factory`
 * (`openStores`), `save()` saves its changed stores after an action's `ok` (`saveStores`; `keel.conflict` on a stale
 * read), and `end()` disposes its scope.
 */
export type ServerRequest = {
  stores(factory: Factory): Promise<unknown>;
  save(): Promise<SaveConflict | null>;
  end(): void;
};

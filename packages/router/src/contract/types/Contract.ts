import type { Href } from "../../types/Href.ts";
import type { Entries } from "./Entries.ts";
import type { HrefArgs } from "./HrefArgs.ts";
import type { PageIds } from "./PageIds.ts";

/**
 * A module's contract (k.contract): its id, its entries keyed by route id, and `href` to its pages (k.router
 * Links). It holds schemas and strings only, so it is client-safe.
 */
export interface Contract<M extends string = string, C extends Entries = Entries> {
  readonly kind: "keel.contract";
  readonly module: M;
  readonly entries: C;
  href<K extends PageIds<C>>(id: K, ...args: HrefArgs<C[K]>): Href;
}

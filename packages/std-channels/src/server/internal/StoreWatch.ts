/** A hub's one `watch` on `ctx.storage` (k.persist Watch): resolved with its stop, or `false`, and the streams holding it, each with how it learns the watch was lost. */
export interface StoreWatch {
  stop: (() => void) | undefined;
  ready: Promise<boolean>;
  readonly holders: Set<() => void>;
}

/** A deployable's storage opened for reading (openStore.ts): a key's text, the commits it reports, if any. */
export type StoreReader = {
  readonly get: (key: string) => Promise<string | undefined>;
  /** Calls `on` after each commit the storage reports (k.persist Watch); absent when it reports none. */
  readonly watch?: (on: () => void) => Promise<() => void>;
  readonly close: () => Promise<void>;
};

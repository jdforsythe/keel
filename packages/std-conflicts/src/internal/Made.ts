import type { Store, Transaction } from "@keel/store";

/** The stores and transactions one run of a factory returned, in the order of its keys. */
export interface Made {
  readonly stores: readonly Store<unknown>[];
  readonly txs: readonly Transaction<unknown, unknown>[];
}

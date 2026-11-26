import { unsafe } from "./unsafe.ts";

/**
 * Throws `e`: an error std.db specifies as a rejection (E1606, E2152, E2153, a key or value it cannot store, a call
 * after `close()`, a failed storage call naming its driver and operation), or a caught driver error passed on unchanged.
 */
export function raise(e: unknown): never {
  return unsafe(
    "std.db specifies a storage driver's failures as rejections of the k.persist storage calls (E1606, E2152, E2153, text it cannot store, a call after close, a failed call naming the driver and operation), which the generated entry and the store layer catch; the storage interface carries no Result, so none is an expected failure a Result would carry",
    () => {
      throw e;
    },
  );
}

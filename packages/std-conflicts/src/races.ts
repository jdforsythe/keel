import type { Snapshot } from "@keel/store";
import type { RaceReport } from "./RaceReport.ts";
import type { StoresFactory } from "./StoresFactory.ts";
import { checkStore } from "./internal/checkStore.ts";
import { withFactory } from "./internal/withFactory.ts";

/**
 * The races of a stored server store (std.conflicts). `snapshot` is the store as stored (`keel.store.<id>`); `stores`
 * is the factory that declares it and its transactions, run in its own registry. The store is the first the factory
 * returns whose state schema accepts `snapshot.state` and which declares every logged transaction. Each rebased entry
 * (one holding `base`) is applied with its concurrent entries in both orders from the state at `base`: a failing order
 * against a holding one is an `invalid` race, two holding orders with different states an `order` race (an array of
 * objects with a string `id` compares as a set). An entry whose base state cannot be rebuilt is `unchecked`. Pure:
 * `snapshot` and every live store stay unchanged.
 */
export function races(snapshot: Snapshot<unknown>, stores: StoresFactory): RaceReport {
  return withFactory(stores, (made) => {
    const st = made.stores.find(
      (x) => x.schema.parse(snapshot.state).ok && snapshot.log.every((e) => x.payloads.has(e.name)),
    );
    if (st === undefined) throw new Error("std.conflicts: no store of the factory holds this snapshot");
    return checkStore(st, made.txs, snapshot);
  });
}

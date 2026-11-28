import { defect } from "@keel/schema";
import type { Snapshot, Store, Transaction } from "@keel/store";
import type { Race } from "../Race.ts";
import type { RaceReport } from "../RaceReport.ts";
import type { Unchecked } from "../Unchecked.ts";
import { applyAll } from "./applyAll.ts";
import { refOf } from "./refOf.ts";

/**
 * The races of `snap`, a snapshot of `st`, using `st` as scratch: for each rebased entry, rebuild the state at its
 * `base` from `initial` and apply it and its concurrent entries in both orders. An entry whose base or orders meet a
 * transaction that throws a dependency's failure is `unchecked` `threw`.
 */
export function checkStore(
  st: Store<unknown>,
  all: readonly Transaction<unknown, unknown>[],
  snap: Snapshot<unknown>,
): RaceReport {
  const txs = new Map(all.filter((t) => t.store === st).map((t) => [t.name, t]));
  for (const e of snap.log)
    if (!txs.has(e.name))
      return defect("std.conflicts: the factory returns no transaction of the store", {
        data: { transaction: e.name, store: st.id },
      });
  const log = snap.log;
  // `initial` is the state at the head before the first kept entry.
  const start = (log[0]?.id ?? 1) - 1;
  const races: Race[] = [];
  const unchecked: Unchecked[] = [];
  log.forEach((e, i) => {
    const base = e.base;
    if (base === undefined) return;
    // A base older than the kept log, or not below the entry's own id (no commit could have seen it), has no
    // rebuildable state.
    if (base < start || base >= e.id) {
      unchecked.push({ store: st.id, id: e.id, reason: "folded" });
      return;
    }
    const seen = log.slice(0, i);
    if (log.slice(1, i + 1).some((x, k) => x.id !== (log[k]?.id ?? 0) + 1)) {
      unchecked.push({ store: st.id, id: e.id, reason: "undo" });
      return;
    }
    const concurrent = seen.filter((x) => x.id > base);
    if (concurrent.length === 0) return;
    const at = applyAll(
      st,
      txs,
      snap.initial,
      seen.filter((x) => x.id <= base),
    );
    // A transaction threw a dependency's failure: the entry is not judged.
    if (at === "threw") {
      unchecked.push({ store: st.id, id: e.id, reason: "threw" });
      return;
    }
    // The kept log cannot rebuild the base state (`initial` fails to restore or a kept entry fails to replay).
    if (at === undefined) {
      unchecked.push({ store: st.id, id: e.id, reason: "folded" });
      return;
    }
    const after = applyAll(st, txs, at.state, [...concurrent, e]);
    const before = applyAll(st, txs, at.state, [e, ...concurrent]);
    if (after === "threw" || before === "threw") {
      unchecked.push({ store: st.id, id: e.id, reason: "threw" });
      return;
    }
    const kind =
      (after === undefined) !== (before === undefined)
        ? "invalid"
        : after !== undefined && before !== undefined && after.text !== before.text
          ? "order"
          : undefined;
    if (kind !== undefined) races.push({ store: st.id, entry: refOf(e), against: concurrent.map(refOf), kind });
  });
  return { races, unchecked };
}

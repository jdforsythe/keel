import { attempt } from "@keel/schema";
import type { LogEntry, Store, Transaction } from "@keel/store";
import { tx } from "@keel/store";
import { Threw } from "./Threw.schema.ts";
import { canonical } from "./canonical.ts";

/**
 * Restore `st` to `state` with an empty log, then apply `entries` in order, each with its own transaction, invariants
 * and schema. The resulting encoded state, or `undefined` when an entry fails: refused, or its transaction function
 * raised a TypeError or RangeError, as a reducer does that reads a state its author did not expect. A transaction
 * function held to the rules throws nothing else but a defect; a defect and any other thrown value pass on.
 */
export function applyAll(
  st: Store<unknown>,
  txs: ReadonlyMap<string, Transaction<unknown, unknown>>,
  state: unknown,
  entries: readonly LogEntry[],
): { readonly state: unknown; readonly text: string } | undefined {
  if (!st.restore({ state, log: [], initial: state }).ok) return undefined;
  for (const e of entries) {
    const t = txs.get(e.name);
    const payload = st.payloads.get(e.name)?.parse(e.payload);
    if (t === undefined || payload === undefined || !payload.ok) return undefined;
    const applied = attempt(
      () => tx(t, payload.value).ok,
      (x) => (x instanceof TypeError || x instanceof RangeError ? Threw.make({}) : undefined),
    );
    if (!applied.ok || !applied.value) return undefined;
  }
  const next = st.snapshot().state;
  return { state: next, text: canonical(next) };
}

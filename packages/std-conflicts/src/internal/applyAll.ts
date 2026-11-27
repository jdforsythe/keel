import { attempt } from "@keel/schema";
import type { LogEntry, Store, Transaction } from "@keel/store";
import { tx } from "@keel/store";
import { Raised } from "./Raised.schema.ts";
import { Threw } from "./Threw.schema.ts";
import { canonical } from "./canonical.ts";

/**
 * Restore `st` to `state` with an empty log, then apply `entries` in order, each with its own transaction, invariants
 * and schema. The resulting encoded state; `undefined` when an entry fails: refused, or its transaction function
 * raised a TypeError or RangeError, as a reducer does that reads a state its author did not expect; `"threw"` when a
 * transaction function threw any other `Error`, a dependency's failure (std.conflicts `threw`). A defect, and a thrown
 * value that is no `Error`, pass on.
 */
export function applyAll(
  st: Store<unknown>,
  txs: ReadonlyMap<string, Transaction<unknown, unknown>>,
  state: unknown,
  entries: readonly LogEntry[],
): { readonly state: unknown; readonly text: string } | "threw" | undefined {
  if (!st.restore({ state, log: [], initial: state }).ok) return undefined;
  for (const e of entries) {
    const t = txs.get(e.name);
    const payload = st.payloads.get(e.name)?.parse(e.payload);
    if (t === undefined || payload === undefined || !payload.ok) return undefined;
    const applied = attempt(
      () => tx(t, payload.value).ok,
      (x) =>
        x instanceof TypeError || x instanceof RangeError
          ? Threw.make({})
          : x instanceof Error
            ? Raised.make({})
            : undefined,
    );
    if (!applied.ok) return applied.error.code === "conflicts.raised" ? "threw" : undefined;
    if (!applied.value) return undefined;
  }
  const next = st.snapshot().state;
  return { state: next, text: canonical(next) };
}

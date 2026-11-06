import { s } from "@keel/schema";
import { transaction, tx } from "@keel/store";
import type { Store, Transaction } from "@keel/store";

/** Name of the identity transaction `holds` defines once per store; it never stays in a log. */
const PROBE = "keel.testing.holds";
const probes = new WeakMap<Store<unknown>, Transaction<unknown, unknown>>();

/**
 * True when `state` satisfies every `invariant` declared on `target`. Stores do not expose their invariants, so
 * this commits an identity transaction from `state` (invariants run on every candidate state) and reads the
 * result. The store is restored to its snapshot from before the call.
 */
export function holds(target: Store<unknown>, state: unknown): boolean {
  let probe = probes.get(target);
  if (probe === undefined) {
    probe = transaction(target, PROBE, s.object({}), (st) => st);
    probes.set(target, probe);
  }
  const before = target.snapshot();
  try {
    if (!target.restore({ state, log: [], initial: state }).ok) return false;
    const r = tx(probe, {});
    return r.ok || r.error.code !== "store.invariant";
  } finally {
    target.restore(before);
  }
}

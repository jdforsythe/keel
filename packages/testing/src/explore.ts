import { type Snapshot, type Transaction, tx } from "@keel/store";
import { canonicalKey } from "./internal/canonicalKey.ts";
import { domainOf } from "./internal/domainOf.ts";
import { modelError } from "./internal/modelError.ts";
import type { ExploreOptions } from "./types/ExploreOptions.ts";
import type { Explored } from "./types/Explored.ts";

/** States when `maxStates` is not given, and the most any run may visit (k.model Bounds). */
const MAX_STATES = 10_000;
const CEILING = 1_000_000;

interface Visit<T> {
  readonly state: T;
  readonly level: number;
  // The edge that first reached this state: its source's index, transaction and payload.
  readonly via: { readonly from: number; readonly t: Transaction<T, unknown>; readonly payload: unknown } | undefined;
}

/**
 * Visit every state a store reaches from a start through `transactions` (k.model), breadth first, and check the
 * store's invariants on each edge. Each edge runs as a `properties` case runs a transaction: the store is restored to
 * the state, `tx` commits, the output is read; the store's snapshot from before the call, log `meta` included, is
 * restored at the end. E1708 an edge broke an invariant or threw (`data`: the shortest path as a snapshot, the
 * transaction and the payload) · E1709 `maxStates` reached, or a closed form that did not close · E1710 bad arguments,
 * or an edge that `tx` refused before the transaction's function ran (`store.undeclared`, `schema.invalid`, `keel.conflict`).
 */
export function explore<T>(
  transactions: readonly Transaction<T, unknown>[],
  options: ExploreOptions<T> = {},
): Explored<T> {
  const st = transactions[0]?.store;
  const names = transactions.map((t) => t.name);
  if (st === undefined || transactions.some((t) => t.store !== st) || new Set(names).size !== names.length)
    throw modelError("E1710", "explore: give one or more transactions of one store, each once", { names });
  const { from, payloads, depth = Number.POSITIVE_INFINITY } = options;
  const max = Math.min(options.maxStates ?? MAX_STATES, CEILING);
  const closed = from === undefined && payloads === undefined && options.depth === undefined;
  const bad = (message: string): Error => modelError("E1710", `explore ${st.id}: ${message}`, { store: st.id });
  if (closed) {
    const missing = [...st.payloads.keys()].filter((name) => !names.includes(name));
    if (missing.length > 0) throw bad(`the closed form needs every transaction; missing ${missing.join(", ")}`);
    if (st.log().length > 0) throw bad("the closed form needs a store with an empty log");
  }
  let start = st.snapshot().state;
  if (from !== undefined) {
    const checked = st.check(from);
    if (!checked.ok) throw bad(`from fails the store's schema or invariants: ${checked.error.message}`);
    start = checked.value;
  }
  const domains = transactions.map((t) => {
    const given = payloads?.[t.name];
    if (given === undefined) {
      const all = domainOf(t.schema);
      if (all === undefined) throw bad(`${t.name} has no finite payload domain; give payloads["${t.name}"]`);
      return all;
    }
    return given.map((p, i) => {
      const parsed = t.schema.parse(p);
      if (!parsed.ok) throw bad(`payloads["${t.name}"][${i}] fails its schema: ${parsed.error.message}`);
      return parsed.value;
    });
  });

  const keyOf = (state: T): string => canonicalKey(st.schema.encode(state));
  const original = st.snapshot({ meta: true });
  const at = (state: T): void => {
    st.restore({ state, log: [], initial: state });
  };
  const visits: Visit<T>[] = [{ state: start, level: 0, via: undefined }];
  const index = new Map<string, number>([[keyOf(start), 0]]);
  const terminal: T[] = [];
  let edges = 0;
  let expanded = 0;
  try {
    for (; expanded < visits.length; expanded++) {
      const visit = visits[expanded];
      if (visit === undefined || visit.level >= depth) break;
      const own = keyOf(visit.state);
      let moved = false;
      transactions.forEach((t, ti) => {
        for (const payload of domains[ti] ?? []) {
          edges++;
          at(visit.state);
          let failed: unknown;
          let next: T | undefined;
          let refused = "";
          try {
            const r = tx(t, payload);
            if (r.ok) next = r.value;
            else if (r.error.code === "store.invariant") failed = r.error;
            else refused = r.error.code;
          } catch (e) {
            failed = e ?? "throw";
          }
          // The edge never reached the transaction's function: the run is set up wrong, not the store.
          if (refused !== "") throw bad(`${t.name} answered ${refused} on an edge, before its function ran`);
          if (failed !== undefined) {
            const steps: Visit<T>[] = [];
            for (let v: Visit<T> | undefined = visit; v?.via !== undefined; v = visits[v.via.from]) steps.unshift(v);
            at(start);
            for (const step of steps) if (step.via !== undefined) tx(step.via.t, step.via.payload);
            const replayed = st.snapshot();
            // The store's clock stamps `at`; a counterexample is the same on every run, so its entries count from 1.
            const snapshot: Snapshot<T> = { ...replayed, log: replayed.log.map((e, i) => ({ ...e, at: i + 1 })) };
            throw modelError(
              "E1708",
              `explore ${st.id}: ${t.name} broke an invariant after ${steps.length} steps (${visits.length} states)`,
              { snapshot, transaction: t.name, payload },
            );
          }
          if (next === undefined) continue;
          const key = keyOf(next);
          if (key === own) continue;
          moved = true;
          if (index.has(key)) continue;
          if (visits.length >= max)
            throw modelError(
              "E1709",
              `explore ${st.id}: maxStates ${max} reached with ${visits.length - expanded} states unexpanded`,
              { states: visits.length, unexpanded: visits.length - expanded },
            );
          index.set(key, visits.length);
          visits.push({ state: next, level: visit.level + 1, via: { from: expanded, t, payload } });
        }
      });
      if (!moved) terminal.push(visit.state);
    }
  } finally {
    st.restore(original);
  }
  const states = visits.map((v) => v.state);
  return {
    states,
    edges,
    depth: visits[visits.length - 1]?.level ?? 0,
    complete: expanded === visits.length,
    terminal,
  };
}

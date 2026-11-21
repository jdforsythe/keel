import type { Infer, Schema } from "@keel/schema";
import type { Store, Transaction } from "@keel/store";
import type { ChartState } from "./ChartState.ts";

/**
 * A chart compiled as one store (std.statecharts): `chart` and `instance` both return one. `store` holds
 * `{ state, data }`, `events` has one transaction per event, and `enabled(state, event, payload)` is true when that
 * event's transaction would change the state's name or apply a `do`.
 */
export type ChartInstance<D, Ev extends Readonly<Record<string, Schema<unknown>>>, S extends string> = {
  readonly store: Store<ChartState<S, D>>;
  readonly events: { readonly [K in keyof Ev]: Transaction<ChartState<S, D>, Infer<Ev[K]>> };
  enabled<K extends keyof Ev>(state: ChartState<S, D>, event: K, payload: Infer<Ev[K]>): boolean;
};

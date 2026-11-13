import type { Infer, Schema } from "@keel/schema";
import type { Store, Transaction } from "@keel/store";
import type { ChartState } from "./ChartState.ts";
import type { StateSpec } from "./StateSpec.ts";

/**
 * A compiled chart (std.statecharts): its store, one transaction per event (`<id>.<event>`), the declared states and
 * `initial`, and `enabled(state, event, payload)`, true when `tx` of that event would change the state's name or apply
 * a `do`.
 */
export type Chart<
  D,
  Ev extends Readonly<Record<string, Schema<unknown>>>,
  S extends string,
  G extends string,
  A extends string,
> = {
  readonly store: Store<ChartState<S, D>>;
  readonly events: { readonly [K in keyof Ev]: Transaction<ChartState<S, D>, Infer<Ev[K]>> };
  readonly states: { readonly [K in S]: StateSpec<keyof Ev & string, S, G, A> };
  readonly initial: S;
  enabled<K extends keyof Ev>(state: ChartState<S, D>, event: K, payload: Infer<Ev[K]>): boolean;
};

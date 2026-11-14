import type { Infer, Schema } from "@keel/schema";
import type { ChartInstance } from "./ChartInstance.ts";
import type { ChartState } from "./ChartState.ts";
import type { StateSpec } from "./StateSpec.ts";
import type { compileKey } from "./internal/compileKey.ts";

/**
 * A compiled chart (std.statecharts): its store, one transaction per event (`<id>.<event>`), the declared states and
 * `initial`, and `enabled(state, event, payload)`, true when `tx` of that event would change the state's name or apply
 * a `do`, and `next(state, event, payload)`, the `{ state, data }` that transaction gives. `instance(chart, key)` compiles it again as the store `<id>:<key>`.
 */
export type Chart<
  D,
  Ev extends Readonly<Record<string, Schema<unknown>>>,
  S extends string,
  G extends string,
  A extends string,
> = ChartInstance<D, Ev, S> & {
  readonly states: { readonly [K in S]: StateSpec<keyof Ev & string, S, G, A> };
  readonly initial: S;
  /** The schema of the chart's `data`. */
  readonly data: Schema<D>;
  /** The `{ state, data }` that `tx` of `event` gives from `state`; a name outside `states` stays as it is. */
  next<K extends keyof Ev, T extends string>(
    state: ChartState<T, D>,
    event: K,
    payload: Infer<Ev[K]>,
  ): ChartState<S | T, D>;
  /** Compiles the declaration again, in the calling scope, as the store `id` (what `instance` calls). */
  readonly [compileKey]: (id: string) => ChartInstance<D, Ev, S>;
};

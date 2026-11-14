import type { Schema } from "@keel/schema";
import type { ChartInstance } from "./ChartInstance.ts";
import type { StateSpec } from "./StateSpec.ts";
import type { compileKey } from "./internal/compileKey.ts";

/**
 * A compiled chart (std.statecharts): its store, one transaction per event (`<id>.<event>`), the declared states and
 * `initial`, and `enabled(state, event, payload)`, true when `tx` of that event would change the state's name or apply
 * a `do`. `instance(chart, key)` compiles it again as the store `<id>:<key>`.
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
  /** Compiles the declaration again, in the calling scope, as the store `id` (what `instance` calls). */
  readonly [compileKey]: (id: string) => ChartInstance<D, Ev, S>;
};

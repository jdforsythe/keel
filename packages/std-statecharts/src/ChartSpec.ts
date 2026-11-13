import type { Schema } from "@keel/schema";
import type { StateSpec } from "./StateSpec.ts";
import type { PayloadOf } from "./internal/PayloadOf.ts";

/**
 * The declaration `chart` takes (std.statecharts). `data` is the schema of the chart's own values and `start` their
 * first value; `events` maps each event to its payload schema; `guards` are pure predicates and `actions` pure updates
 * over `data` and the payload, named by a target's `guard` and `do`; `states` maps each state name to its `on` and
 * `final`, and `initial` names the first.
 */
export type ChartSpec<
  D,
  Ev extends Readonly<Record<string, Schema<unknown>>>,
  S extends string,
  G extends string,
  A extends string,
> = {
  readonly data: Schema<D>;
  readonly start: NoInfer<D>;
  readonly events: Ev;
  readonly guards?: { readonly [K in G]: (data: D, payload: PayloadOf<Ev>) => boolean };
  readonly actions?: { readonly [K in A]: (data: D, payload: PayloadOf<Ev>) => D };
  readonly initial: NoInfer<S>;
  readonly states: { readonly [K in S]: StateSpec<keyof Ev & string, NoInfer<S>, NoInfer<G>, NoInfer<A>> };
};

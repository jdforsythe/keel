import type { Infer, Schema } from "@keel/schema";
import type { Store, Transaction } from "@keel/store";
import type { Instances } from "./Instances.ts";

/**
 * What a workflow's `stores(ctx)` returns (std.workflows): the store and its transactions `start`, one per chart event,
 * `attempt` and `forget`; each changes one instance.
 */
export type WorkflowStores<D, Ev extends Readonly<Record<string, Schema<unknown>>>, S extends string> = {
  readonly store: Store<Instances<S, D>>;
  readonly start: Transaction<Instances<S, D>, { id: string; data: D }>;
  readonly events: { readonly [K in keyof Ev]: Transaction<Instances<S, D>, { id: string; payload: Infer<Ev[K]> }> };
  readonly attempt: Transaction<Instances<S, D>, { id: string; entered: number }>;
  readonly forget: Transaction<Instances<S, D>, { id: string }>;
};

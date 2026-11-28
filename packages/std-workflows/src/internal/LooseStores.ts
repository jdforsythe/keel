import type { Store, Transaction } from "@keel/store";
import type { Instances } from "../Instances.ts";

/** A workflow's stores with the chart events by name, for the runner's own jobs. */
export type LooseStores<S extends string, D> = {
  readonly store: Store<Instances<S, D>>;
  readonly start: Transaction<Instances<S, D>, { id: string; data: D }>;
  readonly events: Readonly<Record<string, Transaction<Instances<S, D>, { id: string; payload: unknown }>>>;
  readonly attempt: Transaction<Instances<S, D>, { id: string; entered: number }>;
  readonly forget: Transaction<Instances<S, D>, { id: string }>;
};

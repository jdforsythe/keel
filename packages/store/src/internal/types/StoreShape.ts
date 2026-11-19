import type { Schema } from "@keel/schema";

/** One store a `stores` factory creates, as `.keel/surface.json` records it (k.compat Surface): id, state schema, payload schemas. */
export type StoreShape = {
  readonly id: string;
  readonly state: Schema<unknown>;
  readonly transactions: Readonly<Record<string, Schema<unknown>>>;
};

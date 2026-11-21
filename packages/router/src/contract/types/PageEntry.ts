import type { ObjectSchema } from "@keel/schema";

/** A page entry (k.contract): its `path`, and the `params` and `search` its links carry. */
export type PageEntry = {
  readonly path: string;
  readonly params?: ObjectSchema<unknown>;
  readonly search?: ObjectSchema<unknown>;
};

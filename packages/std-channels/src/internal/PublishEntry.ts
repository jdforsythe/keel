import type { ObjectSchema } from "@keel/schema";

/** The publish entry of a channel: an API POST on its path taking `{ message }`. */
export type PublishEntry<P, M> = {
  readonly method: "POST";
  readonly path: string;
  readonly query: ObjectSchema<P>;
  readonly body: ObjectSchema<{ message: M }>;
  readonly output: ObjectSchema<Record<string, never>>;
};

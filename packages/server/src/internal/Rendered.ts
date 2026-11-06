import type { JsonValue, KeelError } from "@keel/schema";

/**
 * A rendered chain: its `html`, the props of each island root it marked (`data-k-island`, keyed by route
 * id), and the first error a route boundary caught while rendering (status 500), if any.
 */
export type Rendered = {
  readonly html: string;
  readonly islands: Readonly<Record<string, JsonValue>>;
  readonly caught: KeelError<string, unknown> | null;
};

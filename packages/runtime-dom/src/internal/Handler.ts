import type { Owner } from "./Owner.ts";

/** One entry of the delegated handler table. `at` is the element id given to `on`. */
export interface Handler {
  readonly fn: (event: Event) => unknown;
  readonly owner: Owner;
  readonly at: string;
}

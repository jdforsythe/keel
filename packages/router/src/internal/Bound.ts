import type { Contract } from "../contract/types/Contract.ts";

/** One id of a route table as `bindingsOf` gives it: its contract, its entry and its binding, as written. */
export type Bound = {
  readonly contract: Contract;
  readonly entry: object;
  readonly binding: Readonly<Record<string, unknown>>;
};

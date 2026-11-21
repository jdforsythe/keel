import type { Contract } from "../contract/types/Contract.ts";
import type { Entries } from "../contract/types/Entries.ts";
import type { RouteTable } from "./RouteTable.ts";

/** One module's route table from `manifest(contract, binding)` (k.contract Binding): it also names its contract. */
export interface Manifest<M extends string = string, C extends Entries = Entries> extends RouteTable {
  readonly contract: Contract<M, C>;
}

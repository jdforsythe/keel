import type { ApiEntry, Contract } from "@keel/router/contract";
import type { Client } from "./Client.ts";

type Named<M extends string, E> = {
  readonly [K in keyof E & string as E[K] extends ApiEntry ? (K extends `${M}.${infer N}` ? N : never) : never]: E[K];
};

/**
 * The typed client `service({ contract })` returns: `Client` over the contract's API entries, each keyed by its id
 * after the module (`kitchen.box` is `.box`); a page or layout entry has no method. A contract not typed by its
 * literal entries (`Contract`) has a method per name, each taking and answering `unknown`.
 */
export type ContractClient<C extends Contract> = C extends Contract<infer M extends string, infer E>
  ? string extends keyof E
    ? Client<Readonly<Record<string, ApiEntry>>>
    : Client<Named<M, E>>
  : never;

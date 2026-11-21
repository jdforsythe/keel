import type { ContractCall } from "./ContractCall.ts";

/**
 * An app module's contract as `keel check` reads it: the project directory holding the module (`""` for the root,
 * else e.g. `apps/a/`), the module id (its folder), and the first `contract(...)` call of its
 * `modules/<id>/<id>.contract.ts`.
 */
export type ModuleContract = { readonly dir: string; readonly module: string; readonly contract: ContractCall };

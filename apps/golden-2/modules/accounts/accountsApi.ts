import { service } from "@keel/services";
import { accounts } from "./accounts.contract.ts";

/** A typed client for the `accounts` contract's API entries; the topology resolves where `accounts` runs. */
export const accountsApi = service({ contract: accounts });

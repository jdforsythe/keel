import { service } from "@keel/services";
import { accounts } from "./accounts.service.ts";

/** A typed client for the `accounts` API routes; the topology resolves where `accounts` runs. */
export const accountsApi = service({ module: "accounts", schema: accounts });

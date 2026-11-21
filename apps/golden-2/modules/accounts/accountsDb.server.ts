import { database } from "@keel/std-postgres/server";

/** The accounts' database: the `profiles` and `api_tokens` tables, made by `modules/accounts/migrations/*.sql`. */
export const accountsDb = database("accounts.db");

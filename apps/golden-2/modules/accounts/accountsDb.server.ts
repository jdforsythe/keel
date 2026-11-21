/// <reference types="vite/client" />
import { database } from "@keel/std-postgres/server";

/** The accounts' database: the `profiles` and `api_tokens` tables, made by `./migrations/`. */
export const accountsDb = database("accounts.db", {
  migrations: import.meta.glob<string>("./migrations/*.sql", { query: "?raw", import: "default", eager: true }),
});

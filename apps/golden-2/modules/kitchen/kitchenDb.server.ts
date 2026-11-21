/// <reference types="vite/client" />
import { database } from "@keel/std-postgres/server";

/** The kitchen's database: the `recipes` table, made by `./migrations/`. */
export const kitchenDb = database("kitchen.db", {
  migrations: import.meta.glob<string>("./migrations/*.sql", { query: "?raw", import: "default", eager: true }),
});

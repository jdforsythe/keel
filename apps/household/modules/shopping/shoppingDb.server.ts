import { database } from "@keel/std-postgres/server";

/** The shopping list's database: the `items` table, made by `modules/shopping/migrations/*.sql`. */
export const shoppingDb = database("shopping.db");

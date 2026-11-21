import { database } from "@keel/std-postgres/server";

/** The kitchen's database: the `recipes` table, made by `modules/kitchen/migrations/*.sql`. */
export const kitchenDb = database("kitchen.db");

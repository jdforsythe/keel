import { database } from "@keel/std-postgres/server";

/** The receipts book's database: the `receipts` table, made by `modules/receipts/migrations/*.sql`. */
export const receiptsDb = database("receipts.db");

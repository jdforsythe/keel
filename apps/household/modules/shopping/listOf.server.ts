import type { Ctx } from "@keel/ctx";
import { sql } from "@keel/std-postgres";
import { Item } from "./Item.schema.ts";
import { shoppingDb } from "./shoppingDb.server.ts";

/** The household's list, in the order its items were first added. */
export const listOf = (ctx: Ctx) =>
  shoppingDb(ctx).query(sql(Item)`select id, name, qty, bought, rev from items order by seq`);

import type { Ctx } from "@keel/ctx";
import { type Infer, ok } from "@keel/schema";
import { sql } from "@keel/std-postgres";
import { Item } from "./Item.schema.ts";
import { shoppingDb } from "./shoppingDb.server.ts";
import { writeList } from "./writeList.server.ts";

type Row = Infer<typeof Item>;

/**
 * Reads the list, applies `change` (one of the list rules in `addTo.ts` and `toggleIn.ts`, or a removal) and writes the
 * rows that differ, in one transaction, serializable by default: two members changing the list at once both apply, one
 * after the other. The transaction names the list channel it changes, so every open list stream hears `changed` once it
 * commits, in this process or another on the same database. Answers the list as written.
 */
export const changeList = (ctx: Ctx, change: (items: readonly Row[]) => Row[]) =>
  shoppingDb(ctx).transaction(async (t) => {
    const before = await t.query(sql(Item)`select id, name, qty, bought from items order by seq`);
    if (!before.ok) return before;
    const after = change(before.value);
    const written = await writeList(t, before.value, after);
    return written.ok ? ok(after) : written;
  });

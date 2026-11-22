import type { Ctx } from "@keel/ctx";
import { type Infer, ok } from "@keel/schema";
import { NoRows, sql } from "@keel/std-postgres";
import { Item } from "./Item.schema.ts";
import { shoppingDb } from "./shoppingDb.server.ts";

type Row = Infer<typeof Item>;

/**
 * Reads the list, applies `change` (one of the list rules in `addTo.ts` and `toggleIn.ts`, or a removal) and writes the
 * rows that differ, in one serializable transaction: two members changing the list at once both apply, one after the
 * other. Answers the list as written.
 */
export const changeList = (ctx: Ctx, change: (items: readonly Row[]) => Row[]) =>
  shoppingDb(ctx).transaction(
    async (t) => {
      const before = await t.query(sql(Item)`select id, name, qty, bought from items order by seq`);
      if (!before.ok) return before;
      const after = change(before.value);
      const kept = new Set(after.map((i) => i.id));
      for (const old of before.value) {
        if (kept.has(old.id)) continue;
        const r = await t.run(sql(NoRows)`delete from items where id = ${old.id}`);
        if (!r.ok) return r;
      }
      for (const item of after) {
        const old = before.value.find((i) => i.id === item.id);
        if (old !== undefined && old.qty === item.qty && old.bought === item.bought) continue;
        const r =
          old === undefined
            ? await t.run(
                sql(NoRows)`insert into items (id, name, qty, bought)
                            values (${item.id}, ${item.name}, ${item.qty}, ${item.bought})`,
              )
            : await t.run(
                sql(NoRows)`update items set qty = ${item.qty}, bought = ${item.bought} where id = ${item.id}`,
              );
        if (!r.ok) return r;
      }
      return ok(after);
    },
    { isolation: "serializable" },
  );

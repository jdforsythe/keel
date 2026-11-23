import { type Infer, ok } from "@keel/schema";
import { NoRows, sql } from "@keel/std-postgres";
import type { Tx } from "@keel/std-postgres/server";
import type { Item } from "./Item.schema.ts";
import { listChannel } from "./listChannel.schema.ts";

type Row = Infer<typeof Item>;

/**
 * Inside transaction `t`, writes the rows of `after` that differ from `before`, raising the `rev` of each it updates,
 * and deletes the ones it lacks; when any
 * row changed, names the list channel, so every open list stream hears `changed` once `t` commits. Answers whether a
 * row changed.
 */
export async function writeList(t: Tx, before: readonly Row[], after: readonly Row[]) {
  let changed = false;
  const kept = new Set(after.map((i) => i.id));
  for (const old of before) {
    if (kept.has(old.id)) continue;
    const r = await t.run(sql(NoRows)`delete from items where id = ${old.id}`);
    if (!r.ok) return r;
    changed = true;
  }
  for (const item of after) {
    const old = before.find((i) => i.id === item.id);
    if (old !== undefined && old.qty === item.qty && old.bought === item.bought) continue;
    const r =
      old === undefined
        ? await t.run(
            sql(NoRows)`insert into items (id, name, qty, bought)
                          values (${item.id}, ${item.name}, ${item.qty}, ${item.bought})`,
          )
        : await t.run(
            sql(
              NoRows,
            )`update items set qty = ${item.qty}, bought = ${item.bought}, rev = rev + 1 where id = ${item.id}`,
          );
    if (!r.ok) return r;
    changed = true;
  }
  if (!changed) return ok(false);
  const told = await t.changed(listChannel, {});
  return told.ok ? ok(true) : told;
}

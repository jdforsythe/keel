import type { Ctx } from "@keel/ctx";
import { type Infer, err } from "@keel/schema";
import { NoRows, sql } from "@keel/std-postgres";
import { Item } from "./Item.schema.ts";
import type { ItemRef } from "./ItemRef.schema.ts";
import { WriteKey } from "./WriteKey.schema.ts";
import { shoppingDb } from "./shoppingDb.server.ts";
import { toggleIn } from "./toggleIn.ts";
import { writeList } from "./writeList.server.ts";

/**
 * Moves item `id` to bought or back, for a write a page sent through its outbox, in one transaction. A `key` the table
 * `list_writes` holds for the same `owner` was committed before: the list is answered unchanged, so a write sent again
 * applies once; another member's write with the same key is a write of its own. An item no longer on the list is
 * `keel.notFound`. An item whose `rev` is not `base` changed after the member's page read it: `keel.conflict` with the
 * transaction's name and the item's `rev` as `head`, and nothing is written.
 */
export const markBought = (
  ctx: Ctx,
  id: Infer<typeof ItemRef>["id"],
  bought: boolean,
  write: { readonly owner: string; readonly key: string; readonly base: number },
) =>
  shoppingDb(ctx).transaction(async (t) => {
    const list = () => t.query(sql(Item)`select id, name, qty, bought, rev from items order by seq`);
    const seen = await t.query(sql(WriteKey)`select owner, key from list_writes where owner = ${write.owner} and key = ${write.key}`);
    if (!seen.ok) return seen;
    const before = await list();
    if (!before.ok || seen.value.length > 0) return before;
    const item = before.value.find((i) => i.id === id);
    if (item === undefined)
      return err({ code: "keel.notFound", message: "That item is no longer on the list", data: {} });
    if (item.rev !== write.base)
      return err({
        code: "keel.conflict",
        message: "The item changed first",
        data: { transaction: "shopping.mark", head: item.rev },
      });
    const kept = await t.run(sql(NoRows)`insert into list_writes (owner, key, at) values (${write.owner}, ${write.key}, ${ctx.clock.now()})`);
    if (!kept.ok) return kept;
    if (item.bought === bought) return before;
    const written = await writeList(t, before.value, toggleIn(before.value, id));
    return written.ok ? list() : written;
  });

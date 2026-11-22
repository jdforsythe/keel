import { action } from "@keel/router";
import { err, ok } from "@keel/schema";
import { tx } from "@keel/store";
import { addTo } from "./addTo.ts";
import { changeList } from "./changeList.server.ts";
import { changeStores } from "./changeStores.ts";
import { shopping } from "./shopping.contract.ts";

export const postItem = action(shopping, "shopping.add", { stores: changeStores }, async (body, { stores }, ctx) => {
  const id = ctx.random.id("Item");
  const items = await changeList(ctx, (list) => addTo(list, { id, name: body.name }));
  if (!items.ok) return err(items.error);
  const told = tx(stores.bump, {});
  return told.ok ? ok({ items: items.value }) : err(told.error);
});

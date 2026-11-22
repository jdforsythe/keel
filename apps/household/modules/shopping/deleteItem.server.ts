import { action } from "@keel/router";
import { err, ok } from "@keel/schema";
import { tx } from "@keel/store";
import { changeList } from "./changeList.server.ts";
import { changeStores } from "./changeStores.ts";
import { shopping } from "./shopping.contract.ts";

export const deleteItem = action(shopping, "shopping.remove", { stores: changeStores }, async (_body, args, ctx) => {
  const items = await changeList(ctx, (list) => list.filter((i) => i.id !== args.params.id));
  if (!items.ok) return err(items.error);
  const told = tx(args.stores.bump, {});
  return told.ok ? ok({ items: items.value }) : err(told.error);
});

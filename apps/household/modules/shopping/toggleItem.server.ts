import { action } from "@keel/router";
import { err, ok } from "@keel/schema";
import { tx } from "@keel/store";
import { changeList } from "./changeList.server.ts";
import { changeStores } from "./changeStores.ts";
import { shopping } from "./shopping.contract.ts";
import { toggleIn } from "./toggleIn.ts";

export const toggleItem = action(shopping, "shopping.toggle", { stores: changeStores }, async (_body, args, ctx) => {
  const items = await changeList(ctx, (list) => toggleIn(list, args.params.id));
  if (!items.ok) return err(items.error);
  const told = tx(args.stores.bump, {});
  return told.ok ? ok({ items: items.value }) : err(told.error);
});

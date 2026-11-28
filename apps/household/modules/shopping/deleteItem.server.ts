import { action } from "@keel/router";
import { err, ok } from "@keel/schema";
import { changeList } from "./changeList.server.ts";
import { shopping } from "./shopping.contract.ts";

export const deleteItem = action(shopping, "shopping.remove", {}, async (_body, args, ctx) => {
  const items = await changeList(ctx, (list) => list.filter((i) => i.id !== args.params.id));
  return items.ok ? ok({ items: items.value }) : err(items.error);
});

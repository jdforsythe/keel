import { action } from "@keel/router";
import { err, ok } from "@keel/schema";
import { changeList } from "./changeList.server.ts";
import { shopping } from "./shopping.contract.ts";
import { toggleIn } from "./toggleIn.ts";

export const toggleItem = action(shopping, "shopping.toggle", {}, async (_body, { params }, ctx) => {
  const items = await changeList(ctx, (list) => toggleIn(list, params.id));
  return items.ok ? ok({ items: items.value }) : err(items.error);
});

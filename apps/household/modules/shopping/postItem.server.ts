import { action } from "@keel/router";
import { err, ok } from "@keel/schema";
import { addTo } from "./addTo.ts";
import { changeList } from "./changeList.server.ts";
import { shopping } from "./shopping.contract.ts";

export const postItem = action(shopping, "shopping.add", {}, async (body, _args, ctx) => {
  const id = ctx.random.id("Item");
  const items = await changeList(ctx, (list) => addTo(list, { id, name: body.name }));
  return items.ok ? ok({ items: items.value }) : err(items.error);
});

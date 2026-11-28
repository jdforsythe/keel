import { loader } from "@keel/router";
import { err, ok } from "@keel/schema";
import { listOf } from "./listOf.server.ts";
import { shopping } from "./shopping.contract.ts";

export const getItems = loader(shopping, "shopping.items", {}, async (_args, ctx) => {
  const items = await listOf(ctx);
  return items.ok ? ok({ items: items.value }) : err(items.error);
});

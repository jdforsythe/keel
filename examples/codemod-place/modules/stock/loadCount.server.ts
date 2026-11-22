import { loader } from "@keel/router";
import { ok } from "@keel/schema";
import { stock } from "./stock.contract.ts";

/** GET `/api/stock/:item`: the shelf count, the length of the item's name so the example needs no data. */
export const loadCount = loader(stock, "stock.count", {}, async ({ params }) =>
  ok({ item: params.item, count: params.item.length }),
);

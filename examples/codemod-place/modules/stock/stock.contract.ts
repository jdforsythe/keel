import { contract } from "@keel/router/contract";
import { ItemParams } from "./ItemParams.schema.ts";
import { Stock } from "./Stock.schema.ts";

export const stock = contract("stock", {
  "stock.count": { method: "GET", path: "/api/stock/:item", params: ItemParams, output: Stock },
});
